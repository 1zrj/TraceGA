import { BadRequestException, Injectable } from '@nestjs/common'

type JsonSchema = Record<string, any>

@Injectable()
export class JsonSchemaValidator {
  validate(data: unknown, schema?: JsonSchema | null): void {
    if (!schema || Object.keys(schema).length === 0) {
      return
    }

    const errors: string[] = []
    this.validateNode(data, schema, '$', errors)
    if (errors.length > 0) {
      throw new BadRequestException(`properties do not match param_schema: ${errors.join('; ')}`)
    }
  }

  private validateNode(data: unknown, schema: JsonSchema, path: string, errors: string[]): void {
    if (schema.allOf && Array.isArray(schema.allOf)) {
      schema.allOf.forEach((child: JsonSchema) => this.validateNode(data, child, path, errors))
    }

    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      const valid = schema.anyOf.some((child: JsonSchema) => this.isValid(data, child))
      if (!valid) errors.push(`${path} must match at least one schema in anyOf`)
      return
    }

    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      const matches = schema.oneOf.filter((child: JsonSchema) => this.isValid(data, child)).length
      if (matches !== 1) errors.push(`${path} must match exactly one schema in oneOf`)
      return
    }

    if (schema.const !== undefined && !this.isEqual(data, schema.const)) {
      errors.push(`${path} must equal the configured constant`)
    }
    if (Array.isArray(schema.enum) && !schema.enum.some((value: unknown) => this.isEqual(data, value))) {
      errors.push(`${path} must be one of the configured enum values`)
    }

    if (schema.type && !this.matchesType(data, schema.type)) {
      errors.push(`${path} must be ${schema.type}`)
      return
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      this.validateObject(data as Record<string, unknown>, schema, path, errors)
    } else if (Array.isArray(data)) {
      this.validateArray(data, schema, path, errors)
    } else if (typeof data === 'string') {
      this.validateString(data, schema, path, errors)
    } else if (typeof data === 'number') {
      this.validateNumber(data, schema, path, errors)
    }
  }

  private validateObject(data: Record<string, unknown>, schema: JsonSchema, path: string, errors: string[]): void {
    const required = Array.isArray(schema.required) ? schema.required : []
    required.forEach((key: string) => {
      if (!(key in data)) errors.push(`${path}.${key} is required`)
    })

    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    Object.entries(properties).forEach(([key, childSchema]) => {
      if (key in data) this.validateNode(data[key], childSchema as JsonSchema, `${path}.${key}`, errors)
    })

    Object.entries(data).forEach(([key, value]) => {
      if (key in properties) return
      if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`)
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        this.validateNode(value, schema.additionalProperties, `${path}.${key}`, errors)
      }
    })

    if (typeof schema.minProperties === 'number' && Object.keys(data).length < schema.minProperties) {
      errors.push(`${path} must contain at least ${schema.minProperties} properties`)
    }
    if (typeof schema.maxProperties === 'number' && Object.keys(data).length > schema.maxProperties) {
      errors.push(`${path} must contain at most ${schema.maxProperties} properties`)
    }
  }

  private validateArray(data: unknown[], schema: JsonSchema, path: string, errors: string[]): void {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`)
    }
    if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} items`)
    }
    if (schema.uniqueItems && new Set(data.map(value => JSON.stringify(value))).size !== data.length) {
      errors.push(`${path} must contain unique items`)
    }
    if (schema.items && typeof schema.items === 'object') {
      data.forEach((value, index) => this.validateNode(value, schema.items, `${path}[${index}]`, errors))
    }
  }

  private validateString(data: string, schema: JsonSchema, path: string, errors: string[]): void {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${path} must contain at least ${schema.minLength} characters`)
    }
    if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) {
      errors.push(`${path} must contain at most ${schema.maxLength} characters`)
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(data)) errors.push(`${path} has an invalid format`)
      } catch {
        errors.push(`${path} uses an invalid schema pattern`)
      }
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(data))) {
      errors.push(`${path} must be a valid date-time`)
    }
    if (schema.format === 'uri') {
      try {
        new URL(data)
      } catch {
        errors.push(`${path} must be a valid URI`)
      }
    }
  }

  private validateNumber(data: number, schema: JsonSchema, path: string, errors: string[]): void {
    if (typeof schema.minimum === 'number' && data < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && data > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`)
    if (typeof schema.exclusiveMinimum === 'number' && data <= schema.exclusiveMinimum) errors.push(`${path} must be greater than ${schema.exclusiveMinimum}`)
    if (typeof schema.exclusiveMaximum === 'number' && data >= schema.exclusiveMaximum) errors.push(`${path} must be less than ${schema.exclusiveMaximum}`)
  }

  private isValid(data: unknown, schema: JsonSchema): boolean {
    const errors: string[] = []
    this.validateNode(data, schema, '$', errors)
    return errors.length === 0
  }

  private matchesType(data: unknown, type: string | string[]): boolean {
    if (Array.isArray(type)) return type.some(item => this.matchesType(data, item))
    if (type === 'null') return data === null
    if (type === 'array') return Array.isArray(data)
    if (type === 'object') return data !== null && typeof data === 'object' && !Array.isArray(data)
    if (type === 'integer') return typeof data === 'number' && Number.isInteger(data)
    return typeof data === type
  }

  private isEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right)
  }
}
