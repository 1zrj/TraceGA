import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { EventService } from '../services/event.service'
import { GetEventsDto } from '../dto/get-events.dto'
import { CreateEventDto } from '../dto/create-event.dto'
import { UpdateEventDto } from '../dto/update-event.dto'

@Controller('api/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  findAll(@Query() query: GetEventsDto) {
    return this.eventService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findById(id)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventService.create(createEventDto)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.update(id, updateEventDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id)
  }
}
