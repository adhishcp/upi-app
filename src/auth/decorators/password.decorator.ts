import { registerDecorator, ValidationOptions } from 'class-validator';

export function isStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
            value,
          );
        },
        defaultMessage: () =>
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      },
    });
  };
}
