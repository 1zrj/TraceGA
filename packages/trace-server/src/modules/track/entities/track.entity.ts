import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm'

export interface TrackEvent {
  eventId?: string
  eventType: string
  eventName: string
  appId: string
  userId?: string
  sessionId?: string
  properties?: Record<string, any>
  timestamp?: number
  url?: string
  referrer?: string
  userAgent?: string
  ip?: string
}

@Entity('track_events')
@Index(['appId'])
@Index(['eventType'])
@Index(['timestamp'])
@Index(['userId'])
export class TrackEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  eventId: string

  @Column({ type: 'varchar', length: 50 })
  eventType: string

  @Column({ type: 'varchar', length: 100 })
  eventName: string

  @Column({ type: 'varchar', length: 50 })
  appId: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId: string

  @Column({ type: 'json', nullable: true })
  properties: Record<string, any>

  @Column({ type: 'datetime' })
  timestamp: Date

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date
}