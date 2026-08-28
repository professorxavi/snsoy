import { Box, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { openEntityAside } from "@/app/aside-actions";
import { AsideLinks } from "@/components/compendium/aside-links";
import { ClassTable } from "@/components/compendium/class-table";
import {
  fluffImages,
  IllustrationBanner,
  IllustrationPlate,
  imageCredits,
  isLandscape,
} from "@/components/compendium/entity-image";
import {
  OutlineNav,
  type OutlineItem,
} from "@/components/compendium/outline-nav";
import { ClassSummary } from "@/components/compendium/class-summary";
import { SubraceList } from "@/components/compendium/subrace-accordion";
import { Entries, Inline, OptionBody, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import {
  byPrintedOrder,
  casterLabel,
  collectFeatureReferences,
  descriptionEntries,
  featureOrder,
  indexFeatures,
  type FeatureIndex,
  ordinal,
  proficiencyLines,
  progressionColumns,
  startingEquipment,
} from "@/lib/content/classes";
import {
  collectOptionalFeatures,
  optionalFeatureProgressions,
  type OptionalFeatureIndex,
  type OptionalFeatureProgression,
} from "@/lib/content/optional-features";
import { subjectSide } from "@/lib/content/media";
import { splitSections, uniqueAnchor } from "@/lib/content/outline";
import { collectReferences } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import {
  getClass,
  type ClassFeatureDetail,
} from "@/server/db/queries/classes";
import {
  indexOptionalFeatures,
  listOptionalFeaturesByKey,
  listOptionalFeaturesByType,
  type OptionalFeatureRow,
} from "@/server/db/queries/optional-features";
import { resolveReferences } from "@/server/db/queries/references";

/**
 * One class, as a reading page built around its progression table.
 *
 * The order is the order the books use and the order a player reads in: what
 * the class is, the table of what it gains, what it starts with, then every
 * feature in full, then the subclasses. The table comes before the prose
 * because it is what someone already playing the class came for.
 *
 * Subclasses are disclosures on this page rather than pages of their own. They
 * have a route reserved (`/compendium/subclasses/…`) and no view behind it yet,
 * and a link into a hole is worse than a section that opens in place.
 */

interface RouteParams {
  params: Promise<{ source: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source, slug } = await params;
  const found = await getClass(source, slug);

  if (!found) return { title: "Not found" };

  const summary = [
    found.hitDie ? `d${found.hitDie} hit die` : null,
    casterLabel(found.casterProgression),
    found.subclasses.length > 0
      ? `${found.subclasses.length} ${found.subclassTitle?.toLowerCase() ?? "subclass"}${found.subclasses.length === 1 ? "" : "es"}`
      : null,
  ].filter(Boolean);

  return {
    title: `${found.name} · Classes`,
    description: `${summary.join(" · ")}. ${found.sourceName}${found.page ? `, p. ${found.page}` : ""}.`,
  };
}

export default async function ClassPage({ params }: RouteParams) {
  const { source, slug } = await params;
  const found = await getClass(source, slug);

  if (!found) notFound();

  const order = featureOrder(found.data);
  const allFeatures = [...found.features].sort(byPrintedOrder(order));
  const columns = progressionColumns(found.data);
  const equipment = startingEquipment(found.data);
  const proficiencies = proficiencyLines(found.data);

  // The class's descriptive text lives in its fluff, not its data — a class's
  // own entries are the progression the table already renders. Its named parts
  // ("Creating a Wizard") are sections of this page like any other, so they are
  // split out rather than left to render as headings under nothing.
  const { intro, sections } = splitSections<Entry>(
    descriptionEntries<Entry>(found.fluff, found.name, found.sourceId),
  );
  const images = fluffImages(found.fluff);
  const credits = imageCredits(images);

  /*
   * Two treatments, decided by the shape of the art.
   *
   * A standing figure goes out into the top corner of the page, whole and at
   * size, where it costs the prose nothing. Which corner is the picture's own
   * business: art whose figure stands against the left of its frame takes the
   * right corner and the rest take the left, so the figure always ends up
   * facing across the page rather than off the edge of it.
   *
   * Wide art has no corner to stand in, so it runs as a banner across the top
   * of the column — the same treatment the race pages give landscape plates.
   */
  const [art] = images;
  const banner = art && isLandscape(art) ? art : undefined;
  const plate = art && !banner ? art : undefined;
  const plateSide = subjectSide(plate) === "left" ? "right" : "left";

  const everything = [
    found.data,
    found.fluff,
    ...allFeatures.map((feature) => feature.data),
    ...found.subclasses.flatMap((subclass) => [
      subclass.data,
      ...subclass.features.map((feature) => feature.data),
    ]),
  ];

  /*
   * Features the books compose out of other features: an Alchemist's opening
   * feature grants three more, and Perfected Armor chooses between two armor
   * models. All of them are stored as siblings at the same level, so a page
   * that prints the list flat prints "Guardian" and "Infiltrator" as features
   * in their own right, with nothing to say what they are models of.
   *
   * Each one is printed inside the feature that introduces it, and dropped from
   * the flat list so it is not printed twice. Every reference in the books
   * points at a feature of the same class, which is why this needs no query —
   * the page already holds all 343 of them.
   */
  const featureIndex = indexFeatures([
    ...allFeatures.map((feature) => ({ ...feature, anchorId: feature.slug })),
    ...found.subclasses.flatMap((subclass) =>
      subclass.features.map((feature) => ({
        ...feature,
        anchorId: `${subclass.slug}-${feature.slug}`,
      })),
    ),
  ]);
  const referenced = collectFeatureReferences(everything);
  const standalone = <T extends { naturalKey: string }>(list: T[]) =>
    list.filter((feature) => !referenced.has(feature.naturalKey));

  const features = standalone(allFeatures);

  /*
   * The options this class chooses between, loaded before its references are
   * resolved — an option's own text is full of tags, and resolving them in the
   * same pass is what keeps the page to one round trip for links.
   *
   * Two ways in. A feature that names its options is read by key; a class whose
   * features only say a list exists somewhere is read by the feature types on
   * its progression, which is the sole route to a Warlock's 54 invocations.
   */
  const progressions = [
    ...optionalFeatureProgressions(found.data).map((progression) => ({
      progression,
      subclassId: null as string | null,
    })),
    ...found.subclasses.flatMap((subclass) =>
      optionalFeatureProgressions(subclass.data).map((progression) => ({
        progression,
        subclassId: subclass.id,
      })),
    ),
  ];

  const namedKeys = collectOptionalFeatures(everything);

  const [named, byType] = await Promise.all([
    listOptionalFeaturesByKey([...namedKeys]),
    listOptionalFeaturesByType(
      progressions.flatMap((entry) => entry.progression.featureTypes),
    ),
  ]);
  const options = indexOptionalFeatures([...named, ...byType]);

  // One resolve for the class, every feature, every subclass feature and every
  // option. A Warlock page would otherwise make hundreds of round trips.
  const refs = await resolveReferences(
    collectReferences([...everything, ...named, ...byType]),
  );

  /*
   * Ids are taken against everything already anchored on the page. A feature
   * and the list it points at share a name routinely — the Warlock's Eldritch
   * Invocations feature and its 54 invocations — and two elements answering to
   * one anchor sends every inbound link to whichever the browser reaches first.
   */
  const anchored = new Set([
    PROGRESSION_ID,
    START_ID,
    FEATURES_ID,
    SUBCLASSES_ID,
    ...sections.map((section) => section.id),
    ...allFeatures.map((feature) => feature.slug),
    ...found.subclasses.flatMap((subclass) => [
      subclass.slug,
      ...subclass.features.map((feature) => `${subclass.slug}-${feature.slug}`),
    ]),
  ]);

  /*
   * What is left of each progression once the features have had their say.
   *
   * Ten of the thirteen progressions in the books are already printed in full
   * by the feature that offers them — a Fighter's Fighting Style names all
   * eleven of its options inline — and printing them again under a heading of
   * their own would be the same list twice on one page. Three are not named
   * anywhere: a Warlock's invocations, an Artificer's infusions, and the second
   * fighting style a Champion picks up at 10th level, which the Fighter's own
   * feature has already listed further up this page. Filtering against what the
   * page names, rather than per feature, is what gets that last one right.
   */
  const optionLists = progressions.flatMap(({ progression, subclassId }) => {
    const unnamed = byType.filter(
      (option) =>
        !namedKeys.has(option.naturalKey) &&
        option.featureTypes?.some((type) =>
          progression.featureTypes.includes(type),
        ),
    );

    if (unnamed.length === 0) return [];

    return [
      {
        subclassId,
        progression,
        id: uniqueAnchor(progression.name, anchored),
        options: unnamed,
      },
    ];
  });

  const outline: OutlineItem[] = [
    ...sections.map((section) => ({ id: section.id, label: section.title })),
    { id: PROGRESSION_ID, label: "The class table" },
    ...(proficiencies.length > 0 || equipment.length > 0
      ? [{ id: START_ID, label: "Starting out" }]
      : []),
    { id: FEATURES_ID, label: "Class features" },
    ...optionLists
      .filter((list) => !list.subclassId)
      .map((list) => ({ id: list.id, label: list.progression.name })),
    ...(found.subclasses.length > 0
      ? [
          { id: SUBCLASSES_ID, label: found.subclassTitle ?? "Subclasses" },
          ...found.subclasses.map((subclass) => ({
            id: subclass.slug,
            listKey: subclass.naturalKey,
            label: subclass.name,
            depth: 1 as const,
          })),
        ]
      : []),
  ];

  return (
    <ReadingColumn
      outline={<OutlineNav items={outline} />}
      plate={
        plate ? (
          <IllustrationPlate
            image={plate}
            entityName={found.name}
            side={plateSide}
            priority
          />
        ) : undefined
      }
      plateSide={plateSide}
    >
      {/*
        Wrapped so cross-references open beside the page instead of leaving it.
        Class features are the densest prose in the app for them — 1,441 tags
        across the thirteen classes — and following one used to cost the reader
        the class they were reading.
      */}
      <AsideLinks load={openEntityAside}>
        <Box as="header" mb="6">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="medium"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
          >
            <Box asChild _hover={{ color: "brand" }}>
              <NextLink href={sourceHref(found.sourceId)}>
                {found.sourceName}
              </NextLink>
            </Box>
            {found.page ? ` · p. ${found.page}` : null}
          </Text>

          <Text
            as="h1"
            fontFamily="display"
            fontSize={{ base: "3xl", md: "4xl" }}
            lineHeight="1.05"
            letterSpacing="tight"
            textWrap="balance"
            mt="1"
          >
            {found.name}
          </Text>

          {/*
           * Art in flow goes between the name and the summary rule, so the
           * rule keeps the line it belongs to. Below it are the numbers that
           * describe the class; a picture dropped in among them would read as
           * one more of them.
           *
           * Two things land here. Wide art, which has no corner to stand in —
           * and the corner plate itself at the widths that have no margin to
           * stand it in, where showing it this way beats not showing it.
           */}
          {banner ? (
            <Box mt="4">
              <IllustrationBanner
                image={banner}
                entityName={found.name}
                priority
              />
            </Box>
          ) : null}

          {plate ? (
            <Box display={{ base: "block", lg: "none" }} mt="4">
              <IllustrationBanner
                image={plate}
                entityName={found.name}
                maxHeight={300}
              />
            </Box>
          ) : null}

          <ClassSummary found={found} />
        </Box>

        {intro.length > 0 ? (
          <Box mb="6">
            <Entries
              entries={intro}
              refs={refs}
              selfKey={found.naturalKey}
              context={found.name}
            />
          </Box>
        ) : null}

        {sections.map((section) => (
          <Box
            as="section"
            key={section.id}
            id={section.id}
            scrollMarginTop="4rem"
            mb="6"
          >
            <SectionHeading>
              <Inline text={section.title} refs={refs} context={found.name} />
            </SectionHeading>
            <Entries
              entries={section.entries}
              refs={refs}
              selfKey={found.naturalKey}
              context={found.name}
            />
          </Box>
        ))}

        <Box as="section" id={PROGRESSION_ID} scrollMarginTop="4rem" mb="8">
          <ClassTable
            columns={columns}
            // Every feature, including the ones printed inside another. The
            // table is the book's own index of what arrives at each level.
            rows={featureRows(allFeatures)}
            className={found.name}
            heading={<SectionHeading>The {found.name}</SectionHeading>}
            refs={refs}
          />
        </Box>

        {proficiencies.length > 0 || equipment.length > 0 ? (
          <Box as="section" id={START_ID} scrollMarginTop="4rem" mb="8">
            <SectionHeading>Starting out</SectionHeading>

            {proficiencies.length > 0 ? (
              <Stack gap="1.5" mb={equipment.length > 0 ? "4" : "0"}>
                {proficiencies.map((line) => (
                  <Box key={line.label}>
                    <Text
                      as="span"
                      fontFamily="ui"
                      fontSize="2xs"
                      fontWeight="semibold"
                      letterSpacing="wide"
                      textTransform="uppercase"
                      color="fg.subtle"
                      mr="2"
                    >
                      {line.label}
                    </Text>
                    <Text as="span" fontFamily="body" fontSize="sm">
                      <Inline
                        text={line.value}
                        refs={refs}
                        context={found.name}
                      />
                    </Text>
                  </Box>
                ))}
              </Stack>
            ) : null}

            {equipment.length > 0 ? (
              <Box>
                <Text
                  fontFamily="body"
                  fontSize="sm"
                  color="fg.muted"
                  mb="1.5"
                >
                  You start with the following equipment, in addition to the
                  equipment granted by your background:
                </Text>
                <Entries
                  entries={[{ type: "list", items: equipment }]}
                  refs={refs}
                  selfKey={found.naturalKey}
                  context={found.name}
                />
              </Box>
            ) : null}
          </Box>
        ) : null}

        <Box as="section" id={FEATURES_ID} scrollMarginTop="4rem" mb="8">
          <SectionHeading>Class features</SectionHeading>
          <FeatureList
            features={features}
            refs={refs}
            options={options}
            featureBodies={featureIndex}
            context={found.name}
          />
        </Box>

        {optionLists
          .filter((list) => !list.subclassId)
          .map((list) => (
            <Box
              as="section"
              key={list.id}
              id={list.id}
              scrollMarginTop="4rem"
              mb="8"
            >
              <SectionHeading>{list.progression.name}</SectionHeading>
              <OptionList
                list={list}
                refs={refs}
                options={options}
                context={found.name}
                headingLevel={3}
              />
            </Box>
          ))}

        {found.subclasses.length > 0 ? (
          <Box as="section" id={SUBCLASSES_ID} scrollMarginTop="4rem">
            <SectionHeading>{found.subclassTitle ?? "Subclasses"}</SectionHeading>
            <SubraceList
              items={found.subclasses.map((subclass) => ({
                id: subclass.slug,
                listKey: subclass.naturalKey,
                name: subclass.name,
                meta: [subclass.sourceName, subclass.page ? `p. ${subclass.page}` : ""]
                  .filter(Boolean)
                  .join(" · "),
                body: (
                  <Box>
                    <FeatureList
                      features={standalone(subclass.features)}
                      refs={refs}
                      options={options}
                      featureBodies={featureIndex}
                      context={`${found.name}: ${subclass.name}`}
                      anchorPrefix={subclass.slug}
                    />
                    {/* A Battle Master's maneuvers belong to the archetype,
                        not to the class, so they print inside it. */}
                    {optionLists
                      .filter((list) => list.subclassId === subclass.id)
                      .map((list) => (
                        <Box key={list.id} mt="5">
                          <Text
                            as="h4"
                            fontFamily="body"
                            fontWeight="semibold"
                            fontSize="md"
                            mb="1"
                          >
                            {list.progression.name}
                          </Text>
                          <OptionList
                            list={list}
                            refs={refs}
                            options={options}
                            context={`${found.name}: ${subclass.name}`}
                            headingLevel={5}
                          />
                        </Box>
                      ))}
                  </Box>
                ),
              }))}
            />
          </Box>
        ) : null}

        {credits.length > 0 ? (
          <Box
            as="section"
            mt="10"
            pt="4"
            borderTopWidth="1px"
            borderColor="border"
          >
            <Text
              as="h2"
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
              mb="1"
            >
              Art credits
            </Text>
            <Text fontFamily="body" fontSize="sm" color="fg.muted">
              {credits.join(" · ")}
            </Text>
          </Box>
        ) : null}
      </AsideLinks>
    </ReadingColumn>
  );
}

const PROGRESSION_ID = "the-class-table";
const START_ID = "starting-out";
const FEATURES_ID = "class-features";
const SUBCLASSES_ID = "subclasses";

/** The table's Features column: the names gained at each level, in printed order. */
function featureRows(features: ClassFeatureDetail[]) {
  const byLevel = new Map<number, string[]>();

  for (const feature of features) {
    const names = byLevel.get(feature.level) ?? [];
    names.push(feature.name);
    byLevel.set(feature.level, names);
  }

  return [...byLevel].map(([level, names]) => ({ level, features: names }));
}


/**
 * Features in level order, each under its own heading. The level is printed
 * beside the name rather than as a grouping, because the same feature name
 * recurs at several levels — "Indomitable", then "Indomitable (two uses)".
 *
 * A class feature is anchored on its bare slug, which is what an inbound
 * `{@classFeature}` link resolves to. A subclass's features are anchored under
 * the subclass instead: a subclass and its opening feature share a name and so
 * share a slug — PHB `champion` is both — and the disclosure has the better
 * claim on the plain one.
 */
function FeatureList({
  features,
  refs,
  options,
  featureBodies,
  context,
  anchorPrefix,
}: {
  features: ClassFeatureDetail[];
  refs: Awaited<ReturnType<typeof resolveReferences>>;
  options: OptionalFeatureIndex;
  featureBodies: FeatureIndex;
  context: string;
  anchorPrefix?: string;
}) {
  if (features.length === 0) return null;

  return (
    <Stack gap="5">
      {features.map((feature) => {
        const data = feature.data as { entries?: Entry[] };

        return (
          <Box
            key={feature.id}
            id={anchorPrefix ? `${anchorPrefix}-${feature.slug}` : feature.slug}
            scrollMarginTop="4rem"
          >
            <Text
              as="h3"
              fontFamily="body"
              fontWeight="semibold"
              fontSize="md"
              lineHeight="1.3"
              mb="1"
            >
              {feature.name}
              <Text
                as="span"
                fontFamily="ui"
                fontSize="2xs"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="fg.subtle"
                ml="2"
              >
                {ordinal(feature.level)} level
              </Text>
            </Text>
            <Entries
              entries={data.entries}
              refs={refs}
              options={options}
              features={featureBodies}
              selfKey={feature.naturalKey}
              context={context}
              headingLevel={4}
            />
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * Every option of one kind, printed in full.
 *
 * These are the choices no feature names. A Warlock's invocations, a Battle
 * Master's maneuvers and an Artificer's infusions are reached only by the
 * feature-type codes on the class's progression — the feature text itself says
 * no more than that a list exists somewhere else, which on a page like this one
 * has to mean here.
 */
function OptionList({
  list,
  refs,
  options,
  context,
  headingLevel,
}: {
  list: {
    progression: OptionalFeatureProgression;
    options: OptionalFeatureRow[];
  };
  refs: Awaited<ReturnType<typeof resolveReferences>>;
  options: OptionalFeatureIndex;
  context: string;
  /** Where this list sits in the page's outline; its own heading is above it. */
  headingLevel: 3 | 5;
}) {
  if (list.options.length === 0) return null;

  return (
    <Box>
      {list.progression.known ? (
        <Text fontFamily="body" fontSize="sm" color="fg.muted" mb="3">
          {list.progression.known}.
        </Text>
      ) : null}

      <Stack gap="3">
        {list.options.map((option, index) => (
          <Box key={option.naturalKey}>
            <OptionBody
              option={options[option.naturalKey]!}
              refs={refs}
              options={options}
              context={context}
              headingLevel={headingLevel}
              headingTier={4}
              first={index === 0}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      as="h2"
      display="flow-root"
      fontFamily="body"
      fontWeight="semibold"
      fontSize="lg"
      lineHeight="1.25"
      mb="2"
      pb="1"
      borderBottomWidth="1px"
      borderColor="border"
    >
      {children}
    </Text>
  );
}
