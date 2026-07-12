import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'event_name' })
  eventName: string

  @Column({ name: 'event_type' })
  eventType: string

  @Column()
  category: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ name: 'property_schema', type: 'jsonb', default: {} })
  propertySchema: Record<string, any>

  @Column({ name: 'app_id' })
  appId: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date
}
