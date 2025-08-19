const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

class AIProviderManager {
  constructor() {
    this.providers = {
      gemini: this.setupGemini(),
      openai: this.setupOpenAI(),
      together: this.setupTogether(),
      groq: this.setupGroq(),
      huggingface: this.setupHuggingFace(),
    };
    
    // Response caching for performance
    this.responseCache = new Map();
    this.maxCacheSize = 100;
    this.cacheExpiryTime = 5 * 60 * 1000; // 5 minutes
    
    // Get the default provider from environment, no fallbacks
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
    
    console.log('🔧 AI Providers initialized:');
    Object.entries(this.providers).forEach(([key, provider]) => {
      if (provider) {
        console.log(`   ✅ ${provider.name} (${provider.cost})`);
      } else {
        console.log(`   ❌ ${key} - Not configured`);
      }
    });
  }

  // Wrap a promise with a timeout
  withTimeout(promise, ms, label = 'AI request') {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  setupGemini() {
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ Gemini API key not found');
      return null;
    }
    
    try {
      const genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
      
      return {
        name: 'Google Gemini',
        cost: 'free',
        generate: async (prompt) => {
          try {
            console.log('🤖 Calling Gemini API...');
            const response = await this.withTimeout(
              genAI.models.generateContent({
                model: 'gemini-2.0-flash-001',
                contents: prompt,
              }),
              20000,
              'Gemini request'
            );
            
            if (response && response.text) {
              console.log('✅ Gemini API response received');
              return response.text;
            }
            
            throw new Error('No valid response from Gemini API');
          } catch (error) {
            console.error('❌ Gemini API Error:', error && error.message ? error.message : String(error));
            throw error;
          }
        }
      };
    } catch (error) {
      console.log('⚠️ Gemini setup failed:', error.message);
      return null;
    }
  }

  setupOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found');
      return null;
    }
    
    return {
      name: 'OpenAI GPT-4',
      cost: 'paid',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling OpenAI API...');
          
          const response = await this.withTimeout(axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }), 20000, 'OpenAI request');
          
          console.log('✅ OpenAI API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ OpenAI API Error:', error && error.message ? error.message : String(error));
          throw error;
        }
      }
    };
  }

  setupTogether() {
    if (!process.env.TOGETHER_API_KEY) {
      console.log('❌ Together API key not found');
      return null;
    }
    
    return {
      name: 'Together AI',
      cost: 'free_tier',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling Together API...');
          
          const response = await this.withTimeout(axios.post('https://api.together.xyz/v1/chat/completions', {
            model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }), 20000, 'Together request');
          
          console.log('✅ Together API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ Together API Error:', error && error.message ? error.message : String(error));
          throw error;
        }
      }
    };
  }

  setupGroq() {
    if (!process.env.GROQ_API_KEY) {
      console.log('❌ Groq API key not found');
      return null;
    }
    
    return {
      name: 'Groq',
      cost: 'free_tier',
      generate: async (prompt) => {
        try {
          console.log('🤖 Calling Groq API...');
          
          const response = await this.withTimeout(axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.8
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }), 20000, 'Groq request');
          
          console.log('✅ Groq API response received');
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('❌ Groq API Error:', error && error.message ? error.message : String(error));
          throw error;
        }
      }
    };
  }

  setupHuggingFace() {
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.log('❌ HuggingFace API key not found');
      return null;
    }
    
    return {
      name: 'Hugging Face',
      cost: 'free',
    generate: async (prompt) => {
        try {
          console.log('🤖 Calling HuggingFace API...');
          
      const response = await this.withTimeout(axios.post(
            'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            { inputs: prompt },
            {
              headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
      ), 20000, 'HuggingFace request');
          
          console.log('✅ HuggingFace API response received');
          return response.data[0]?.generated_text || "Response received but couldn't extract text.";
        } catch (error) {
      console.error('❌ HuggingFace API Error:', error && error.message ? error.message : String(error));
          throw error;
        }
      }
    };
  }

  // Get available providers
  getAvailableProviders() {
    const available = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      if (provider !== null) {
        available[key] = {
          name: provider.name,
          cost: provider.cost
        };
      }
    }
    return available;
  }

  // Generate response using specified provider with caching
  async generateResponse(prompt, providerName = null) {
    const cacheKey = this.generateCacheKey(prompt, providerName);
    
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit for ${providerName || this.defaultProvider} response`);
      return cached;
    }
    
    console.log(`🎯 Attempting to generate response with ${providerName || this.defaultProvider}`);
    
    const targetProvider = providerName ? 
      this.providers[providerName] : 
      this.providers[this.defaultProvider];
    
    if (!targetProvider) {
      const availableProviders = Object.keys(this.providers).filter(key => this.providers[key] !== null);
      throw new Error(`Provider '${providerName || this.defaultProvider}' not available. Available providers: ${availableProviders.join(', ')}`);
    }
    
    try {
      console.log(`🚀 Using ${targetProvider.name} to generate response`);
      const response = await targetProvider.generate(prompt);
      console.log(`✅ Successfully generated response using ${targetProvider.name}`);
      
      // Cache the response
      this.cacheResponse(cacheKey, response);
      
      return response;
    } catch (error) {
      console.error(`❌ ${targetProvider.name} failed:`, error.message);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  // Generate cache key from prompt and provider
  generateCacheKey(prompt, providerName) {
    const normalizedPrompt = prompt.toLowerCase().trim();
    // Use first 100 chars + hash of full prompt for cache key
    const shortPrompt = normalizedPrompt.substring(0, 100);
    const hash = require('crypto').createHash('md5').update(normalizedPrompt).digest('hex').substring(0, 8);
    return `${providerName || this.defaultProvider}_${shortPrompt}_${hash}`;
  }

  // Get cached response if valid
  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiryTime) {
      return cached.response;
    }
    
    // Remove expired cache
    if (cached) {
      this.responseCache.delete(cacheKey);
    }
    
    return null;
  }

  // Cache response with LRU eviction
  cacheResponse(cacheKey, response) {
    // Don't cache very long responses (likely dynamic content)
    if (response.length > 5000) {
      return;
    }
    
    // LRU eviction
    if (this.responseCache.size >= this.maxCacheSize) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
  }

  // Get provider info
  getProviderInfo(providerName) {
    const provider = this.providers[providerName];
    if (!provider) return null;
    
    return {
      name: provider.name,
      cost: provider.cost,
      available: true
    };
  }
}

// Create global instance
const aiProviderManager = new AIProviderManager();

module.exports = {
  AIProviderManager,
  aiProviderManager
}; 