import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';

/** Đổi lỗi Prisma phổ biến thành HTTP status có nghĩa thay vì 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(toHttpException(error) ?? error, host);
  }
}

function toHttpException(
  error: Prisma.PrismaClientKnownRequestError,
): HttpException | undefined {
  switch (error.code) {
    case 'P2002':
      return new ConflictException('Dữ liệu bị trùng với bản ghi đã có');
    case 'P2025':
      return new NotFoundException('Không tìm thấy dữ liệu');
    case 'P2003':
      return new ConflictException('Dữ liệu đang được tham chiếu ở nơi khác');
    default:
      return undefined;
  }
}
