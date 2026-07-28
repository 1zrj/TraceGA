import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AiService } from '../services/ai.service'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() query: AiAnalyzeDto) {
    return this.aiService.analyze(query)
  }
}
