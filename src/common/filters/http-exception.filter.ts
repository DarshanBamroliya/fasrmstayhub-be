import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiResponse } from '../responses/api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.message
                : 'Internal server error';

        // Log the error with full details
        const errorLog = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message: message,
            error: exception instanceof HttpException 
                ? exception.getResponse() 
                : exception instanceof Error 
                    ? exception.message 
                    : 'Unknown error',
            stack: exception instanceof Error ? exception.stack : undefined,
        };

        // Log to console
        this.logger.error(
            `${request.method} ${request.url} - ${status} - ${message}`,
            exception instanceof Error ? exception.stack : JSON.stringify(errorLog),
        );

        // For non-HTTP exceptions, log full error details
        if (!(exception instanceof HttpException)) {
            this.logger.error('Full error details:', errorLog);
        }

        const errorResponse = new ApiResponse(true, message, null);

        response.status(status).json(errorResponse);
    }
}
