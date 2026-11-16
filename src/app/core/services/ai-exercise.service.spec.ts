import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AiExerciseService } from './ai-exercise.service';
import { TranslationService } from './translation.service';

describe('AiExerciseService', () => {
  let service: AiExerciseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiExerciseService, TranslationService],
    });
    service = TestBed.inject(AiExerciseService);
  });

  it('genera un ejercicio aleatorio con campos requeridos y 3 opciones', () => {
    const exercise = service.generateRandomExercise('medium');

    expect(exercise).toBeDefined();
    expect(exercise.id).toMatch(/^ai_/);
    expect(exercise.scenarioTitle.length).toBeGreaterThan(5);
    expect(exercise.scenarioDescription.length).toBeGreaterThan(10);
    expect(exercise.options.length).toBe(3);

    const correctOptions = exercise.options.filter((opt) => opt.isCorrect);
    expect(correctOptions.length).toBe(1);

    const incorrectOptions = exercise.options.filter((opt) => !opt.isCorrect);
    expect(incorrectOptions.length).toBe(2);

    expect(exercise.mitreCode).toMatch(/^T\d+/);
    expect(exercise.cisoRecommendation.length).toBeGreaterThan(10);
  });

  it('respeta los niveles de dificultad al generar ejercicios', () => {
    const easy = service.generateRandomExercise('easy');
    expect(['Baja', 'Media']).toContain(easy.threatLevel);

    const hard = service.generateRandomExercise('hard');
    expect(['Alta', 'Crítica']).toContain(hard.threatLevel);
  });
});
