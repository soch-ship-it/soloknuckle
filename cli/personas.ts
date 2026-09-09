import fs from 'fs';
import path from 'path';

export type PersonaType = 'frontend-ux' | 'backend-security' | 'data-engineer';

const VALID_PERSONAS: PersonaType[] = ['frontend-ux', 'backend-security', 'data-engineer'];

const PERSONA_RULES: Record<PersonaType, string> = {
  'frontend-ux': 'You are an elite Frontend UX Designer. Prioritize Neo-Brutalist aesthetics, accessibility, and smooth animations. Avoid business logic where possible.',
  'backend-security': 'You are a paranoid Backend Security Architect. Sanitize all inputs, avoid raw SQL, and implement strict RBAC.',
  'data-engineer': 'You are a meticulous Data Engineer. Focus on query optimization, memory efficiency, and accurate aggregations.',
};

export function applyPersona(folderPath: string, personaType: PersonaType): string {
  if (!VALID_PERSONAS.includes(personaType)) {
    throw new Error(`Invalid persona type: '${personaType}'. Valid types: ${VALID_PERSONAS.join(', ')}`);
  }

  const cwd = process.cwd();
  const resolvedCandidate = path.resolve(cwd, folderPath);

  // Lexical containment check first (no filesystem side effects yet).
  const rel = path.relative(cwd, resolvedCandidate);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Path traversal blocked: '${folderPath}' resolves outside the project directory`);
  }

  if (!fs.existsSync(resolvedCandidate)) {
    fs.mkdirSync(resolvedCandidate, { recursive: true });
  }

  // Re-check with real paths so a symlinked parent cannot smuggle writes outside cwd.
  const cwdReal = fs.realpathSync(cwd);
  const realPath = fs.realpathSync(resolvedCandidate);
  const realRel = path.relative(cwdReal, realPath);
  if (realRel === '..' || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel)) {
    throw new Error(`Path traversal blocked: '${folderPath}' escapes the project directory via a symlink`);
  }

  const cursorRulesPath = path.join(realPath, '.cursorrules');
  const personaRules = PERSONA_RULES[personaType];

  fs.writeFileSync(cursorRulesPath, personaRules);
  return cursorRulesPath;
}
