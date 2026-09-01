import { useAnimationControls } from 'motion/react';
import { useCallback } from 'react';

// ---------------------------------------------
// Animação de recusa do formulário
// Dispara o movimento por controle imperativo em vez de remontar o formulário
// com uma chave nova: a remontagem reiniciava a animação, mas jogava o foco
// de volta ao documento a cada tentativa, obrigando quem navega por teclado a
// percorrer a página inteira de novo para corrigir a senha.
// ---------------------------------------------
export function useAnimacaoDeErro() {
  const controle = useAnimationControls();

  const sacudirAgora = useCallback(() => {
    void controle.start('erro');
  }, [controle]);

  return { controle, sacudirAgora };
}
