/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common'
import { JsonSchemaValidator } from '../validators/json-schema.validator'

describe('JsonSchemaValidator', () => {
  const validator = new JsonSchemaValidator()
  const schema = {
    type: 'object',
    required: ['method', 'amount'],
    additionalProperties: false,
    properties: {
      method: { type: 'string', enum: ['phone', 'email'] },
      amount: { type: 'number', minimum: 0 },
      tags: {
        type: 'array',
        maxItems: 2,
        uniqueItems: true,
        items: { type: 'string', minLength: 1 },
      },
    },
  }

  it('accepts properties that match the event schema', () => {
    expect(() => validator.validate({ method: 'email', amount: 99, tags: ['new'] }, schema)).not.toThrow()
  })

  it('reports required, enum and range violations', () => {
    expect(() => validator.validate({ method: 'wechat', amount: -1 }, schema)).toThrow(BadRequestException)
    expect(() => validator.validate({ method: 'email' }, schema)).toThrow('$.amount is required')
  })

  it('rejects additional properties and invalid array items', () => {
    expect(() => validator.validate({ method: 'phone', amount: 1, extra: true, tags: ['same', 'same', 'third'] }, schema)).toThrow(BadRequestException)
  })

  it('supports composed schemas and common string formats', () => {
    expect(() => validator.validate('https://example.com', { allOf: [{ type: 'string' }, { format: 'uri' }] })).not.toThrow()
    expect(() => validator.validate('invalid', { anyOf: [{ type: 'integer' }, { type: 'boolean' }] })).toThrow(BadRequestException)
  })

  it('allows an empty or missing schema', () => {
    expect(() => validator.validate({ anything: true }, null)).not.toThrow()
    expect(() => validator.validate({ anything: true }, {})).not.toThrow()
  })
})
