/**
 * Tests for Devin skill discovery via .devin/skills/ directory.
 *
 * Verifies:
 * - discoverSkills() finds skills placed in .devin/skills/<name>/SKILL.md
 * - '.devin/skills' is included in prioritySearchDirs (via grep verification)
 * - Skills in .devin/skills/ are found alongside skills in other agent directories
 *
 * Fulfills: VAL-INT-001
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverSkills } from '../src/skills.ts';

describe('discoverSkills finds skills in .devin/skills/', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skills-devin-discovery-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should discover a skill in .devin/skills/ directory', async () => {
    // Create a skill inside .devin/skills/
    mkdirSync(join(testDir, '.devin', 'skills', 'my-devin-skill'), { recursive: true });
    writeFileSync(
      join(testDir, '.devin', 'skills', 'my-devin-skill', 'SKILL.md'),
      `---
name: my-devin-skill
description: A skill installed for Devin
---

# My Devin Skill
`
    );

    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-devin-skill');
    expect(skills[0].description).toBe('A skill installed for Devin');
  });

  it('should discover multiple skills in .devin/skills/ directory', async () => {
    // Create multiple skills inside .devin/skills/
    mkdirSync(join(testDir, '.devin', 'skills', 'devin-skill-a'), { recursive: true });
    writeFileSync(
      join(testDir, '.devin', 'skills', 'devin-skill-a', 'SKILL.md'),
      `---
name: devin-skill-a
description: Devin skill A
---

# Devin Skill A
`
    );

    mkdirSync(join(testDir, '.devin', 'skills', 'devin-skill-b'), { recursive: true });
    writeFileSync(
      join(testDir, '.devin', 'skills', 'devin-skill-b', 'SKILL.md'),
      `---
name: devin-skill-b
description: Devin skill B
---

# Devin Skill B
`
    );

    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['devin-skill-a', 'devin-skill-b']);
  });

  it('should discover .devin/skills/ alongside other agent skill directories', async () => {
    // Create a skill in .devin/skills/
    mkdirSync(join(testDir, '.devin', 'skills', 'devin-skill'), { recursive: true });
    writeFileSync(
      join(testDir, '.devin', 'skills', 'devin-skill', 'SKILL.md'),
      `---
name: devin-skill
description: Skill for Devin
---

# Devin Skill
`
    );

    // Create a skill in .claude/skills/
    mkdirSync(join(testDir, '.claude', 'skills', 'claude-skill'), { recursive: true });
    writeFileSync(
      join(testDir, '.claude', 'skills', 'claude-skill', 'SKILL.md'),
      `---
name: claude-skill
description: Skill for Claude
---

# Claude Skill
`
    );

    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['claude-skill', 'devin-skill']);
  });

  it('should not duplicate skills found in .devin/skills/ and another location', async () => {
    // Same skill name in both .devin/skills/ and .agents/skills/
    mkdirSync(join(testDir, '.agents', 'skills', 'shared-skill'), { recursive: true });
    writeFileSync(
      join(testDir, '.agents', 'skills', 'shared-skill', 'SKILL.md'),
      `---
name: shared-skill
description: Shared skill in agents
---

# Shared Skill
`
    );

    mkdirSync(join(testDir, '.devin', 'skills', 'shared-skill'), { recursive: true });
    writeFileSync(
      join(testDir, '.devin', 'skills', 'shared-skill', 'SKILL.md'),
      `---
name: shared-skill
description: Shared skill in devin
---

# Shared Skill
`
    );

    const skills = await discoverSkills(testDir);

    // Should deduplicate by name — only one instance
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('shared-skill');
  });
});

describe('prioritySearchDirs includes .devin/skills', () => {
  it('src/skills.ts contains .devin/skills in prioritySearchDirs', () => {
    const skillsSource = readFileSync(join(__dirname, '..', 'src', 'skills.ts'), 'utf-8');
    // Verify that .devin/skills appears in the prioritySearchDirs section
    expect(skillsSource).toContain("join(searchPath, '.devin/skills')");
  });
});
