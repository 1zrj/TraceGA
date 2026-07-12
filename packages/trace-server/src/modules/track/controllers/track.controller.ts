import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { Request } from 'express'
import { TrackService } from '../services/track.service'
import { TrackEventDto } from '../dto/track-event.dto'
import { TrackBatchDto } from '../dto/track-batch.dto'

@Controller('api/track')
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  track(@Body() trackEventDto: TrackEventDto, @Req() req: Request) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || ''
    const userAgent = req.headers['user-agent'] || ''
    return this.trackService.trackEvent(trackEventDto, ip, userAgent)
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  trackBatch(@Body() trackBatchDto: TrackBatchDto, @Req() req: Request) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || ''
    const userAgent = req.headers['user-agent'] || ''
    return this.trackService.trackBatch(trackBatchDto, ip, userAgent)
  }
}
