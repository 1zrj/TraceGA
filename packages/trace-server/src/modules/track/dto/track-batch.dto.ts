import { ArrayMaxSize, ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { TrackEventDto } from './track-event.dto'

export class TrackBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[]
}
