import { crearPuntosMejora } from './improvement-insights';

describe('crearPuntosMejora', () => {
  it('combina resultados del mismo eje y ordena primero el desempeño más bajo', () => {
    const puntos = crearPuntosMejora([
      { eje: 'fraude', totalAciertos: 8, totalDecisiones: 10 },
      { eje: 'higiene', totalAciertos: 1, totalDecisiones: 4 },
      { eje: 'fraude', totalAciertos: 1, totalDecisiones: 2 },
    ]);

    expect(puntos.map(({ eje, porcentajeAciertos }) => [eje, porcentajeAciertos])).toEqual([
      ['higiene', 25],
      ['fraude', 75],
    ]);
    expect(puntos[0].nivel).toBe('Requiere práctica');
  });

  it('clasifica correctamente un eje con una sola decisión', () => {
    const [punto] = crearPuntosMejora([
      { eje: 'relación de riesgo', totalAciertos: 1, totalDecisiones: 1 },
    ]);

    expect(punto.porcentajeAciertos).toBe(100);
    expect(punto.nivel).toBe('Fortaleza');
    expect(punto.recomendacion).toContain('otro canal');
  });

  it('no crea prioridades cuando no hay resultados válidos', () => {
    expect(crearPuntosMejora([
      { eje: 'fraude', totalAciertos: 2, totalDecisiones: 1 },
      { eje: 'higiene', totalAciertos: 0, totalDecisiones: 0 },
    ])).toEqual([]);
  });
});
