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

        // Extract detailed validation errors if available
        let validationErrors: any = null;
        
        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
                validationErrors = (exceptionResponse as any).message;
                
                // Format validation errors for user-friendly display
                if (Array.isArray(validationErrors)) {
                    // Create a user-friendly error message
                    const errorMessages = validationErrors.map((err: string) => {
                        // Convert technical messages to user-friendly ones
                        return err
                            .replace(/must not be less than (\d+)/g, 'must be at least $1')
                            .replace(/must be a string/g, 'must be text')
                            .replace(/must be an integer/g, 'must be a whole number')
                            .replace(/must be a number/g, 'must be a number')
                            .replace(/should not be empty/g, 'is required')
                            .replace(/must not be empty/g, 'is required');
                    });
                    
                    // Create a single combined message (one line)
                    const combinedMessage = errorMessages.join(', ');
                    
                    const errorResponse = new ApiResponse(true, combinedMessage, null);
                    response.status(status).json(errorResponse);
                    return;
                } else if (typeof validationErrors === 'string') {
                    const errorResponse = new ApiResponse(true, validationErrors, null);
                    response.status(status).json(errorResponse);
                    return;
                }
            }
        }

        // Log the error with full details
        const errorLog = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message: message,
            validationErrors: validationErrors,
            error: exception instanceof HttpException
                ? exception.getResponse()
                : exception instanceof Error
                    ? exception.message
                    : 'Unknown error',
            stack: exception instanceof Error ? exception.stack : undefined,
        };

        // Log to console with validation details
        if (validationErrors) {
            this.logger.error(
                `${request.method} ${request.url} - ${status} - ${message}\nValidation Errors: ${JSON.stringify(validationErrors, null, 2)}`,
                exception instanceof Error ? exception.stack : '',
            );
        } else {
            this.logger.error(
                `${request.method} ${request.url} - ${status} - ${message}`,
                exception instanceof Error ? exception.stack : JSON.stringify(errorLog),
            );
        }

        // For non-HTTP exceptions, log full error details
        if (!(exception instanceof HttpException)) {
            this.logger.error('Full error details:', errorLog);
        }

        // Format general error message
        let userFriendlyMessage = message;
        if (status === HttpStatus.BAD_REQUEST) {
            userFriendlyMessage = 'Invalid request. Please check your input and try again.';
        } else if (status === HttpStatus.UNAUTHORIZED) {
            userFriendlyMessage = 'Authentication required. Please login and try again.';
        } else if (status === HttpStatus.FORBIDDEN) {
            userFriendlyMessage = 'You do not have permission to perform this action.';
        } else if (status === HttpStatus.NOT_FOUND) {
            userFriendlyMessage = 'The requested resource was not found.';
        } else if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            userFriendlyMessage = 'An unexpected error occurred. Please try again later.';
        }

        const errorResponse = new ApiResponse(true, userFriendlyMessage, null);

        response.status(status).json(errorResponse);
    }
}
