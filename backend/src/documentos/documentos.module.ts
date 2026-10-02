import { Module } from '@nestjs/common';
import {
  DocumentosController,
  DocumentosDownloadController,
} from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [DocumentosController, DocumentosDownloadController],
  providers: [DocumentosService, UploadsService],
  exports: [UploadsService],
})
export class DocumentosModule {}
