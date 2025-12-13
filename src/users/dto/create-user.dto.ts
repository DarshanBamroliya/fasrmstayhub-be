import { IsEmail, IsOptional, IsString, IsNotEmpty, ValidateIf, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

// Custom validator to ensure at least one of email or mobile is provided
function IsEmailOrMobile(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEmailOrMobile',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          return !!(obj.email || obj.mobile);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either email or mobile must be provided';
        },
      },
    });
  };
}

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional()
  @ValidateIf((o) => !o.mobile || o.email)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsEmailOrMobile({ message: 'Either email or mobile must be provided' })
  email?: string;

  @ApiPropertyOptional({ description: 'Mobile number', example: '+919876543210' })
  @IsOptional()
  @ValidateIf((o) => !o.email || o.mobile)
  @IsString({ message: 'Mobile number must be a string' })
  mobile?: string;

  @ApiProperty({ description: 'Name of the user', example: 'John Doe' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required and cannot be empty' })
  name: string;
}
