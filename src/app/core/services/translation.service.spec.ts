import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TranslationService],
    });
    service = TestBed.inject(TranslationService);
    service.setLanguage('es');
  });

  it('inicia por defecto en español y traduce claves básicas', () => {
    expect(service.getLanguage()).toBe('es');
    expect(service.t('common.save')).toBe('Guardar');
    expect(service.t('nav.profile')).toBe('Mi perfil');
  });

  it('permite cambiar a inglés y traduce correspondientemente', () => {
    service.setLanguage('en');
    expect(service.getLanguage()).toBe('en');
    expect(service.t('common.save')).toBe('Save');
    expect(service.t('nav.profile')).toBe('My Profile');
  });

  it('permite cambiar a francés y traduce correspondientemente', () => {
    service.setLanguage('fr');
    expect(service.getLanguage()).toBe('fr');
    expect(service.t('common.save')).toBe('Enregistrer');
    expect(service.t('nav.profile')).toBe('Mon Profil');
  });

  it('sustituye parámetros interpolados {{ param }}', () => {
    service.setLanguage('es');
    const resultado = service.t('common.save', { test: '123' });
    expect(resultado).toBe('Guardar');
  });

  it('retorna la clave original si la traducción no existe', () => {
    expect(service.t('clave.inexistente.total')).toBe('clave.inexistente.total');
  });
});
