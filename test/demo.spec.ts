import { test, expect } from '@playwright/test';
import 'playwright-ai-matchers';

test.describe('playwright-ai-matchers — demo', () => {
  test('toSatisfy · valida una respuesta técnica en lenguaje natural', async () => {
    const response = `
      Un JWT tiene tres partes separadas por puntos: header, payload y signature.
      El servidor lo firma con una clave secreta (HMAC) o privada (RSA/ECDSA) y
      el cliente lo envía en cada request vía el header Authorization: Bearer.
    `;

    await expect(response).toSatisfy(
      'explica la estructura de un JWT y cómo se transmite en requests',
    );
  });

  test('toHallucinate · detecta datos inventados contra un contexto verdadero', async () => {
    const groundTruth =
      'La Revolución de Mayo ocurrió en Buenos Aires en 1810. La Primera Junta fue presidida por Cornelio Saavedra.';

    const respuestaFiel =
      'La Revolución de Mayo fue en 1810, en Buenos Aires, y la Primera Junta la presidió Saavedra.';

    const respuestaAlucinada =
      'La Revolución de Mayo ocurrió en 1776 y la Primera Junta fue presidida por José de San Martín.';

    await expect(respuestaFiel).not.toHallucinate(groundTruth);
    await expect(respuestaAlucinada).toHallucinate(groundTruth);
  });

  test('toIAHaveSentiment · valida el tono empático de un chatbot de soporte', async () => {
    const response = `
      Lamento mucho la demora con tu envío, entiendo lo frustrante que debe ser.
      Ya escalé tu caso al equipo de logística y le pusimos prioridad.
      Te aviso apenas tenga novedades. Gracias por la paciencia.
    `;

    await expect(response).toIAHaveSentiment('empático');
  });

  test('toIAHaveIntent · valida que un agente de ventas esté agendando una cita', async () => {
    const response = `
      Me encantaría mostrarte la plataforma en una demo de 20 minutos.
      ¿Te viene mejor el martes a las 10 o el jueves a las 15?
      Te mando la invitación al toque que me confirmes.
    `;

    await expect(response).toIAHaveIntent(
      'agendar una reunión o demo con el usuario',
    );
  });
});
