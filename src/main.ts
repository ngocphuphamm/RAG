import { NestFactory } from '@nestjs/core';
import { RootModule } from './root.module';
import { H3Logger } from '@high3ar/common-api';

async function bootstrap() {
  const app = await NestFactory.create(RootModule);
  H3Logger.initialize();
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
