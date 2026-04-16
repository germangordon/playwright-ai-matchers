 # Playwright AI Matchers 🤖🚀

  Potencia tus tests de Playwright con aserciones semánticas impulsadas por IA. 
  La v2.0 es agnóstica de proveedores, permitiendo a los SDETs validar
  comportamientos complejos de UI mediante lenguaje natural sin acoplarse a un  
  único LLM.      
                                                                              
  ## 🌟 Novedades v2.0                                                        

  - **Multi-Provider:** Soporte nativo para Anthropic (Claude 3.5 Sonnet),      
  OpenAI (GPT-4o / o3-mini) y Google Gemini (2.5).
  - **Prompt Caching:** Implementación nativa del caching de Anthropic para     
  reducir costos hasta un 90% en suites de regresión.                           
  - **Deep Reasoning:** Modo `high` effort para validaciones que requieren    
  razonamiento multi-paso sobre el DOM.                                         
  - **Provider-Agnostic API:** Una única interfaz (`toPassAI`) que abstrae las
  diferencias entre SDKs.                                                       
                                                                              
  ## 📦 Instalación                                                             
                                                                              
  ```bash                                                                     
  npm install --save-dev playwright-ai-matchers                               

  Peer Dependencies                                                             
  
  Instala únicamente el SDK del proveedor que vayas a utilizar:                 
                                                                              
  # Anthropic (recomendado para suites grandes gracias al caching)              
  npm install --save-dev @anthropic-ai/sdk                                      
                                                                              
  # OpenAI                                                                      
  npm install --save-dev openai                                               
                                                                                
  # Google Gemini                                                             
  npm install --save-dev @google/generative-ai                                

  ▎ Nota: @playwright/test >= 1.40 es requerido como peer dependency            
  ▎ obligatoria.
                                                                                
  ⚙️  Configuración                                                              
                                                                              
  Crea un archivo .env en la raíz de tu proyecto con las credenciales del       
  proveedor seleccionado:                                                     
                                                                              
  # Selecciona el proveedor activo: anthropic | openai | google
  AI_PROVIDER=anthropic                                                         
                                                                                
  # API Keys (solo la que corresponda al proveedor activo)                      
  ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx                                     
  OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx                                            
  GOOGLE_API_KEY=AIzaxxxxxxxxxxxxxxxx                                           
                                                                                
  # Opcional: override del modelo por defecto                                   
  AI_MODEL=claude-3-5-sonnet-20241022                                           
                                                                                
  🚀 Uso                                                                      
                                                                                
  1. Registrar los matchers                                                     
                                                                              
  En tu archivo de setup (playwright.config.ts o un fixture global):            
                                                                              
  import { expect } from '@playwright/test';                                    
  import { aiMatchers } from 'playwright-ai-matchers';                        
                                                                                
  expect.extend(aiMatchers);
                                                                                
  2. Aserción estándar                                                          
                                                                              
  import { test, expect } from '@playwright/test';                              
                                                                              
  test('el checkout muestra el resumen de compra correctamente', async ({ page  
  }) => {
    await page.goto('/checkout');                                               
                                                                                
    const summary = page.locator('[data-testid="order-summary"]');            
                                                                                
    await expect(summary).toPassAI(                                             
      'Debe mostrar el subtotal, los impuestos desglosados y el total final en 
  formato de moneda'                                                            
    );                                                                        
  });                                                                           
                                                                              
  3. Aserción con Deep Reasoning (high effort)                                

  Para validaciones que requieren inferencia compleja (ej. consistencia de      
  datos, lógica de negocio visual):
                                                                                
  test('el dashboard refleja coherencia entre KPIs y gráficos', async ({ page })
   => {                                                                         
    await page.goto('/dashboard');
                                                                                
    const dashboard = page.locator('#main-dashboard');                          
                                                                              
    await expect(dashboard).toPassAI(                                           
      'La suma de las ventas mensuales en el gráfico de barras debe coincidir '
  +                                                                             
      'con el KPI "Ventas Totales" mostrado en la parte superior',
      { effort: 'high' }                                                        
    );                                                                          
  });                                                                           
                                                                                
  📊 Matriz de Compatibilidad                                                 
                                                                                
  ┌─────────────────┬─────────────────┬────────────────────┬────────────────┐   
  │     Feature     │   Anthropic     │ OpenAI (GPT-4o /   │ Google Gemini  │
  │                 │  (Claude 3.5)   │      o3-mini)      │     (2.5)      │   
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Semantic        │       ✅        │         ✅         │       ✅       │
  │ Matching        │                 │                    │                │   
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Prompt Caching  │   ✅ (nativo)   │  ⚠️  (automático)   │       ❌       │
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Deep Reasoning  │  ✅ (extended   │    ✅ (o3-mini)    │ ✅ (thinking)  │ 
  │                 │     think)      │                    │                │   
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Vision /        │       ✅        │         ✅         │       ✅       │
  │ Screenshots     │                 │                    │                │   
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Streaming       │       ✅        │         ✅         │       ✅       │
  ├─────────────────┼─────────────────┼────────────────────┼────────────────┤   
  │ Costo relativo  │       $$        │        $$$         │       $        │ 
  └─────────────────┴─────────────────┴────────────────────┴────────────────┘   
                                                                              
  ---                                                                           
  Creado con ❤️ por Germán Gordón                                             
  ```   