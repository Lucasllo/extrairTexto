import {
  Controller,
  Get,
  UseInterceptors,
  UploadedFile,
  Post,
  Param,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getDadosFixo() {
    return this.appService.extractText(null, null);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post()
  getDados(@UploadedFile() file: Express.Multer.File) {
    return this.appService.extractTextExternal(file);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('porLinha')
  getDadosPorLinha(@UploadedFile() file: Express.Multer.File) {
    return this.appService.extractTextExternalAllLines(file);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('filtro/:filtro')
  getDadosFiltro(
    @UploadedFile() file: Express.Multer.File,
    @Param('filtro') filter: string,
  ) {
    return this.appService.extractTextExternalFilter(file, filter);
  }
}
