import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../responses/api-response';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ApiResponse<T>> {
        return next
            .handle()
            .pipe(
                map((data) => {
                    // If data is already an ApiResponse, return it as is
                    if (data instanceof ApiResponse) {
                        return data;
                    }
                    // Otherwise, wrap it in ApiResponse
                    return new ApiResponse(false, 'Success', data);
                })
            );
    }
}
