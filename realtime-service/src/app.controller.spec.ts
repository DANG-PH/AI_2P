import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports a healthy process', () => {
      const response = appController.health();

      expect(response.status).toBe('ok');
      expect(typeof response.ts).toBe('number');
      expect(typeof response.uptime).toBe('number');
    });
  });
});
