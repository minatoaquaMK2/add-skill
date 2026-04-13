/**
 * Integration tests for Devin skill installation.
 *
 * Verifies:
 * - Symlink install creates .agents/skills/<name> + symlink at .devin/skills/<name>
 * - Copy install writes directly to .devin/skills/<name>
 * - Global install resolves to ~/.config/devin/skills
 * - listInstalledSkills finds skills in .devin/skills/
 * - 'devin' is accepted as a valid agent (no "Invalid agents" error)
 * - End-to-end config + installer + discovery consistency
 *
 * Fulfills: VAL-INT-002, VAL-INT-003, VAL-INT-004, VAL-INT-005, VAL-INT-008, VAL-CROSS-001
 */

import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import {
  installSkillForAgent,
  getAgentBaseDir,
  getCanonicalSkillsDir,
  listInstalledSkills,
  isSkillInstalled,
} from '../src/installer.ts';
import { agents, isUniversalAgent } from '../src/agents.ts';
import * as agentsModule from '../src/agents.ts';
import { discoverSkills } from '../src/skills.ts';

/** Creates a temporary skill source directory with a valid SKILL.md */
async function makeSkillSource(root: string, name: string): Promise<string> {
  const dir = join(root, 'source-skill');
  await mkdir(dir, { recursive: true });
  const skillMd = `---\nname: ${name}\ndescription: A test skill for ${name}\n---\n\n# ${name}\n`;
  await writeFile(join(dir, 'SKILL.md'), skillMd, 'utf-8');
  return dir;
}

// ─── VAL-INT-002: Symlink installation for Devin ────────────────────────────

describe('Devin symlink installation (VAL-INT-002)', () => {
  it('copies skill to .agents/skills/<name> and symlinks from .devin/skills/<name>', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-symlink-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-test-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );

      // Result assertions
      expect(result.success).toBe(true);
      expect(result.mode).toBe('symlink');

      // Canonical directory should contain the skill as a real directory
      const canonicalPath = join(projectDir, '.agents', 'skills', skillName);
      const canonicalStats = await lstat(canonicalPath);
      expect(canonicalStats.isDirectory()).toBe(true);
      expect(canonicalStats.isSymbolicLink()).toBe(false);

      // Verify SKILL.md contents in canonical location
      const canonicalContent = await readFile(join(canonicalPath, 'SKILL.md'), 'utf-8');
      expect(canonicalContent).toContain(`name: ${skillName}`);

      // Agent-specific path should be a symlink
      const agentPath = join(projectDir, '.devin', 'skills', skillName);
      const agentStats = await lstat(agentPath);
      expect(agentStats.isSymbolicLink()).toBe(true);

      // Symlink should resolve to the canonical location
      const symlinkContent = await readFile(join(agentPath, 'SKILL.md'), 'utf-8');
      expect(symlinkContent).toContain(`name: ${skillName}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns canonicalPath pointing to .agents/skills/<name>', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-symlink-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-canonical-test';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );

      expect(result.success).toBe(true);
      expect(result.canonicalPath).toBe(join(projectDir, '.agents', 'skills', skillName));
      expect(result.path).toBe(join(projectDir, '.devin', 'skills', skillName));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ─── VAL-INT-003: Copy installation for Devin ───────────────────────────────

describe('Devin copy installation (VAL-INT-003)', () => {
  it('writes directly to .devin/skills/<name> without canonical directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-copy-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-copy-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'copy', global: false }
      );

      // Result assertions
      expect(result.success).toBe(true);
      expect(result.mode).toBe('copy');

      // Skill should be written directly to .devin/skills/<name>
      const agentPath = join(projectDir, '.devin', 'skills', skillName);
      const agentStats = await lstat(agentPath);
      expect(agentStats.isDirectory()).toBe(true);
      expect(agentStats.isSymbolicLink()).toBe(false);

      // Verify SKILL.md exists and has correct content
      const content = await readFile(join(agentPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain(`name: ${skillName}`);

      // Canonical .agents/skills/<name> should NOT exist for copy mode
      const canonicalPath = join(projectDir, '.agents', 'skills', skillName);
      await expect(lstat(canonicalPath)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns undefined canonicalPath for copy mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-copy-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-copy-no-canonical';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'copy', global: false }
      );

      expect(result.success).toBe(true);
      expect(result.canonicalPath).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ─── VAL-INT-004: Global installation paths ─────────────────────────────────

describe('Devin global installation paths (VAL-INT-004)', () => {
  it('getAgentBaseDir returns ~/.config/devin/skills for global', () => {
    const home = homedir();
    const configHome = process.env.XDG_CONFIG_HOME || join(home, '.config');
    const expected = join(configHome, 'devin', 'skills');

    const result = getAgentBaseDir('devin', true);
    expect(result).toBe(expected);
  });

  it('agents.devin.globalSkillsDir is defined (supports global install)', () => {
    expect(agents.devin.globalSkillsDir).toBeDefined();
    expect(typeof agents.devin.globalSkillsDir).toBe('string');
  });

  it('getAgentBaseDir returns <cwd>/.devin/skills for project-level', () => {
    const cwd = '/tmp/test-project';
    const expected = join(cwd, '.devin', 'skills');

    const result = getAgentBaseDir('devin', false, cwd);
    expect(result).toBe(expected);
  });

  it('devin is not a universal agent so getAgentBaseDir does not return canonical path', () => {
    expect(isUniversalAgent('devin')).toBe(false);

    const cwd = '/tmp/test-project';
    const agentDir = getAgentBaseDir('devin', false, cwd);
    const canonicalDir = getCanonicalSkillsDir(false, cwd);

    // Non-universal agents have different paths
    expect(agentDir).not.toBe(canonicalDir);
    expect(agentDir).toBe(join(cwd, '.devin', 'skills'));
    expect(canonicalDir).toBe(join(cwd, '.agents', 'skills'));
  });
});

// ─── VAL-INT-005: CLI accepts -a devin ──────────────────────────────────────

describe('Devin agent recognition (VAL-INT-005)', () => {
  it("'devin' is a key in the agents record", () => {
    const agentKeys = Object.keys(agents);
    expect(agentKeys).toContain('devin');
  });

  it('installSkillForAgent accepts devin without error', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-accept-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-accept-test';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      // This should not throw or return an "Invalid agents" error
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('isSkillInstalled works with devin agent type', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-installed-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'devin-check-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      // Before install: not installed
      const beforeCheck = await isSkillInstalled(skillName, 'devin', {
        cwd: projectDir,
      });
      expect(beforeCheck).toBe(false);

      // Install
      await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );

      // After install: installed
      const afterCheck = await isSkillInstalled(skillName, 'devin', {
        cwd: projectDir,
      });
      expect(afterCheck).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ─── VAL-INT-008: listInstalledSkills finds Devin skills ────────────────────

describe('listInstalledSkills with Devin (VAL-INT-008)', () => {
  it('finds skills in .devin/skills/ and attributes them to devin', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-list-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    // Mock: devin is detected as installed
    vi.spyOn(agentsModule, 'detectInstalledAgents').mockResolvedValue(['devin']);

    try {
      // Create a skill directly in .devin/skills/
      const devinSkillDir = join(projectDir, '.devin', 'skills', 'listed-skill');
      await mkdir(devinSkillDir, { recursive: true });
      await writeFile(
        join(devinSkillDir, 'SKILL.md'),
        `---\nname: listed-skill\ndescription: A skill found by list\n---\n\n# listed-skill\n`,
        'utf-8'
      );

      const skills = await listInstalledSkills({
        global: false,
        cwd: projectDir,
      });

      expect(skills.length).toBeGreaterThanOrEqual(1);
      const listedSkill = skills.find((s) => s.name === 'listed-skill');
      expect(listedSkill).toBeDefined();
      expect(listedSkill!.agents).toContain('devin');
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('finds symlink-installed skills via listInstalledSkills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-list-sym-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    // Mock: devin is detected as installed
    vi.spyOn(agentsModule, 'detectInstalledAgents').mockResolvedValue(['devin']);

    const skillName = 'symlink-listed-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      // Install via symlink mode
      const installResult = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );
      expect(installResult.success).toBe(true);

      const skills = await listInstalledSkills({
        global: false,
        cwd: projectDir,
      });

      expect(skills.length).toBeGreaterThanOrEqual(1);
      const found = skills.find((s) => s.name === skillName);
      expect(found).toBeDefined();
      expect(found!.agents).toContain('devin');
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ─── VAL-CROSS-001: End-to-end consistency ──────────────────────────────────

describe('End-to-end config + installer + discovery consistency (VAL-CROSS-001)', () => {
  it('agents.devin.skillsDir matches getAgentBaseDir path', () => {
    const cwd = '/tmp/cross-test';
    const agentBaseDir = getAgentBaseDir('devin', false, cwd);
    const expected = join(cwd, agents.devin.skillsDir);
    expect(agentBaseDir).toBe(expected);
  });

  it('after symlink install, discoverSkills finds the skill in .devin/skills/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-cross-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    const skillName = 'cross-discover-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );
      expect(result.success).toBe(true);

      // discoverSkills should find it (via .devin/skills/ or .agents/skills/)
      const discovered = await discoverSkills(projectDir);
      const found = discovered.find((s) => s.name === skillName);
      expect(found).toBeDefined();
      expect(found!.description).toContain('test skill');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('after symlink install, listInstalledSkills finds the skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-cross-list-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    vi.spyOn(agentsModule, 'detectInstalledAgents').mockResolvedValue(['devin']);

    const skillName = 'cross-list-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );
      expect(result.success).toBe(true);

      const installed = await listInstalledSkills({
        global: false,
        cwd: projectDir,
      });
      const found = installed.find((s) => s.name === skillName);
      expect(found).toBeDefined();
      expect(found!.agents).toContain('devin');
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('after install, both discoverSkills and listInstalledSkills find the same skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devin-both-'));
    const projectDir = join(root, 'project');
    await mkdir(projectDir, { recursive: true });

    vi.spyOn(agentsModule, 'detectInstalledAgents').mockResolvedValue(['devin']);

    const skillName = 'unified-find-skill';
    const skillDir = await makeSkillSource(root, skillName);

    try {
      const result = await installSkillForAgent(
        { name: skillName, description: 'test', path: skillDir },
        'devin',
        { cwd: projectDir, mode: 'symlink', global: false }
      );
      expect(result.success).toBe(true);

      // Both should find it
      const discovered = await discoverSkills(projectDir);
      const installed = await listInstalledSkills({
        global: false,
        cwd: projectDir,
      });

      const discoveredSkill = discovered.find((s) => s.name === skillName);
      const installedSkill = installed.find((s) => s.name === skillName);

      expect(discoveredSkill).toBeDefined();
      expect(installedSkill).toBeDefined();
      expect(discoveredSkill!.name).toBe(installedSkill!.name);
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });
});
