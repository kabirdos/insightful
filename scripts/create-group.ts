/**
 * One-off seeding: create a group and make a user its owner.
 *
 * Usage (runs against whatever DATABASE_URL is in the environment —
 * point it at prod deliberately, it only ever INSERTs):
 *
 *   npx tsx scripts/create-group.ts <slug> "<name>" <owner-username>
 *   npx tsx scripts/create-group.ts hyperzen "HyperZen" craigdossantos
 *
 * Idempotent: an existing group with the slug is reused; membership is
 * upserted. Prints the group URL and a fresh 30-day invite link.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [slug, name, username] = process.argv.slice(2);
  if (!slug || !name || !username) {
    console.error(
      'Usage: npx tsx scripts/create-group.ts <slug> "<name>" <owner-username>',
    );
    process.exit(2);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`No user with username "${username}"`);
    process.exit(1);
  }

  const group =
    (await prisma.group.findUnique({ where: { slug } })) ??
    (await prisma.group.create({
      data: { slug, name, createdById: user.id },
    }));

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id, role: "owner" },
    update: { role: "owner" },
  });

  const invite = await prisma.groupInvite.create({
    data: {
      groupId: group.id,
      token: randomBytes(16).toString("hex"),
      createdById: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://insightharness.com";
  console.log(`Group:  ${base}/g/${group.slug}`);
  console.log(
    `Invite: ${base}/g/join/${invite.token} (expires ${invite.expiresAt?.toISOString()})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
