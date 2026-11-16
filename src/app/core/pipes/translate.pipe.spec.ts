import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../services/translation.service';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TranslatePipe, TranslationService],
    });
    pipe = TestBed.inject(TranslatePipe);
    service = TestBed.inject(TranslationService);
    service.setLanguage('es');
  });

  it('traduce una clave existente correctamente', () => {
    expect(pipe.transform('common.back')).toBe('Volver');
  });

  it('retorna cadena vacía si no se pasa clave', () => {
    expect(pipe.transform('')).toBe('');
  });
});
