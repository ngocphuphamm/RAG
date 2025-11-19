import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class StreamQueryRequest {
  @IsString()
  @IsNotEmpty({ message: 'Query must be a non-empty string' })
  @MaxLength(5000, { message: 'Maximum 5000 characters allowed' })
  query: string;
}