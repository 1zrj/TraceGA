import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('alarms')
export class Alarm {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'alarm_name' })
  alarmName: string

  @Column({ name: 'alarm_type' })
  alarmType: string

  @Column({ name: 'event_name' })
  eventName: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'jsonb', default: {} })
  conditions: Record<string, any>

  @Column({ default: true })
  enabled: boolean

  @Column({ name: 'app_id' })
  appId: string

  @Column({ name: 'triggered_at', type: 'timestamp', nullable: true })
  triggeredAt: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
