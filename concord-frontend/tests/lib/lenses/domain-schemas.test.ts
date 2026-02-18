import { describe, it, expect } from 'vitest';
import {
  DOMAIN_SCHEMAS,
  getDomainSchema,
  getDomainEntities,
  getDomainRelations,
  getDomainsWithSchemas,
} from '@/lib/lenses/domain-schemas';


describe('DOMAIN_SCHEMAS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DOMAIN_SCHEMAS)).toBe(true);
    expect(DOMAIN_SCHEMAS.length).toBeGreaterThan(0);
  });

  it('every schema has required fields', () => {
    for (const schema of DOMAIN_SCHEMAS) {
      expect(typeof schema.domain).toBe('string');
      expect(schema.domain.length).toBeGreaterThan(0);
      expect(Array.isArray(schema.entities)).toBe(true);
      expect(schema.entities.length).toBeGreaterThan(0);
      expect(Array.isArray(schema.relations)).toBe(true);
    }
  });

  it('every entity has required fields', () => {
    for (const schema of DOMAIN_SCHEMAS) {
      for (const entity of schema.entities) {
        expect(typeof entity.name).toBe('string');
        expect(entity.name.length).toBeGreaterThan(0);
        expect(typeof entity.displayField).toBe('string');
        expect(Array.isArray(entity.fields)).toBe(true);
        expect(entity.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it('every field has name and type', () => {
    for (const schema of DOMAIN_SCHEMAS) {
      for (const entity of schema.entities) {
        for (const field of entity.fields) {
          expect(typeof field.name).toBe('string');
          expect(typeof field.type).toBe('string');
        }
      }
    }
  });

  it('every relation has from, to, type, and foreignKey', () => {
    for (const schema of DOMAIN_SCHEMAS) {
      for (const relation of schema.relations) {
        expect(typeof relation.from).toBe('string');
        expect(typeof relation.to).toBe('string');
        expect(['one-to-one', 'one-to-many', 'many-to-many']).toContain(relation.type);
        expect(typeof relation.foreignKey).toBe('string');
      }
    }
  });

  it('has no duplicate domain names', () => {
    const domains = DOMAIN_SCHEMAS.map(s => s.domain);
    const unique = new Set(domains);
    expect(unique.size).toBe(domains.length);
  });

  it('includes core domains', () => {
    const domains = DOMAIN_SCHEMAS.map(s => s.domain);
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
    expect(domains).toContain('graph');
  });

  it('includes super-lens domains', () => {
    const domains = DOMAIN_SCHEMAS.map(s => s.domain);
    expect(domains).toContain('healthcare');
    expect(domains).toContain('legal');
    expect(domains).toContain('accounting');
  });
});

describe('getDomainSchema', () => {
  it('returns schema for known domain', () => {
    const schema = getDomainSchema('paper');
    expect(schema).toBeDefined();
    expect(schema!.domain).toBe('paper');
    expect(schema!.entities.length).toBeGreaterThan(0);
  });

  it('returns schema for healthcare domain', () => {
    const schema = getDomainSchema('healthcare');
    expect(schema).toBeDefined();
    expect(schema!.domain).toBe('healthcare');
    const entityNames = schema!.entities.map(e => e.name);
    expect(entityNames).toContain('Patient');
  });

  it('returns undefined for unknown domain', () => {
    expect(getDomainSchema('nonexistent-domain')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getDomainSchema('')).toBeUndefined();
  });
});

describe('getDomainEntities', () => {
  it('returns entities for known domain', () => {
    const entities = getDomainEntities('paper');
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
    const names = entities.map(e => e.name);
    expect(names).toContain('project');
    expect(names).toContain('claim');
  });

  it('returns empty array for unknown domain', () => {
    const entities = getDomainEntities('nonexistent');
    expect(entities).toEqual([]);
  });

  it('returns entities for code domain', () => {
    const entities = getDomainEntities('code');
    expect(entities.length).toBeGreaterThan(0);
    const names = entities.map(e => e.name);
    expect(names).toContain('project');
    expect(names).toContain('snippet');
    expect(names).toContain('review');
  });
});

describe('getDomainRelations', () => {
  it('returns relations for known domain', () => {
    const relations = getDomainRelations('paper');
    expect(Array.isArray(relations)).toBe(true);
    expect(relations.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown domain', () => {
    const relations = getDomainRelations('nonexistent');
    expect(relations).toEqual([]);
  });

  it('returns empty array for domain with no relations', () => {
    const relations = getDomainRelations('government');
    expect(relations).toEqual([]);
  });

  it('returns relations for code domain', () => {
    const relations = getDomainRelations('code');
    expect(relations.length).toBeGreaterThan(0);
    expect(relations[0].from).toBe('snippet');
    expect(relations[0].to).toBe('project');
  });
});

describe('getDomainsWithSchemas', () => {
  it('returns array of domain strings', () => {
    const domains = getDomainsWithSchemas();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBe(DOMAIN_SCHEMAS.length);
    for (const d of domains) {
      expect(typeof d).toBe('string');
    }
  });

  it('contains all schema domains', () => {
    const domains = getDomainsWithSchemas();
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
    expect(domains).toContain('graph');
    expect(domains).toContain('healthcare');
  });
});

describe('field validation rules', () => {
  it('paper project title has maxLength validation', () => {
    const schema = getDomainSchema('paper');
    const project = schema!.entities.find(e => e.name === 'project');
    const titleField = project!.fields.find(f => f.name === 'title');
    expect(titleField!.validation).toBeDefined();
    expect(titleField!.validation!.maxLength).toBe(200);
  });

  it('paper claim confidence has min/max validation', () => {
    const schema = getDomainSchema('paper');
    const claim = schema!.entities.find(e => e.name === 'claim');
    const confidenceField = claim!.fields.find(f => f.name === 'confidence');
    expect(confidenceField!.validation).toBeDefined();
    expect(confidenceField!.validation!.min).toBe(0);
    expect(confidenceField!.validation!.max).toBe(1);
  });

  it('enum fields have enumValues', () => {
    const schema = getDomainSchema('paper');
    const project = schema!.entities.find(e => e.name === 'project');
    const statusField = project!.fields.find(f => f.name === 'status');
    expect(statusField!.type).toBe('enum');
    expect(statusField!.enumValues).toBeDefined();
    expect(statusField!.enumValues!.length).toBeGreaterThan(0);
  });

  it('reference fields have refEntity', () => {
    const schema = getDomainSchema('paper');
    const claim = schema!.entities.find(e => e.name === 'claim');
    const projectIdField = claim!.fields.find(f => f.name === 'projectId');
    expect(projectIdField!.type).toBe('reference');
    expect(projectIdField!.refEntity).toBe('project');
  });
});

describe('entity metadata', () => {
  it('paper project has versioned and softDelete flags', () => {
    const schema = getDomainSchema('paper');
    const project = schema!.entities.find(e => e.name === 'project');
    expect(project!.versioned).toBe(true);
    expect(project!.softDelete).toBe(true);
  });

  it('some entities have audited fields', () => {
    const schema = getDomainSchema('paper');
    const project = schema!.entities.find(e => e.name === 'project');
    const auditedFields = project!.fields.filter(f => f.audited);
    expect(auditedFields.length).toBeGreaterThan(0);
  });

  it('some entities have indexed fields', () => {
    const schema = getDomainSchema('paper');
    const project = schema!.entities.find(e => e.name === 'project');
    const indexedFields = project!.fields.filter(f => f.indexed);
    expect(indexedFields.length).toBeGreaterThan(0);
  });
});
