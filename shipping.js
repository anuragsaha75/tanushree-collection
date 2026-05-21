/**
 * ══════════════════════════════════════════════════════════════
 *  TANUSHREE COLLECTIONS — SHIPPING ENGINE
 *  Centralized, reusable shipping calculation logic.
 *  Loaded ONCE; used by checkout.html and any future pages.
 * ══════════════════════════════════════════════════════════════
 *
 *  Firestore structure (shippingSettings/main):
 *  {
 *    states: {
 *      "West Bengal": [
 *        { maxWeight: 500,  charge: 40 },
 *        { maxWeight: 1000, charge: 70 },
 *        { maxWeight: 2000, charge: 120 }
 *      ],
 *      "Maharashtra": [
 *        { maxWeight: 500,  charge: 100 },
 *        { maxWeight: 1000, charge: 160 },
 *        { maxWeight: 2000, charge: 250 }
 *      ]
 *    },
 *    favourPincodes: {
 *      "732101": { state: "West Bengal", charge: 20 }
 *    },
 *    defaultCharge: 150     // fallback when state not configured
 *  }
 */

window.ShippingEngine = (() => {

  // ── In-memory cache so we don't hit Firestore on every keystroke ──
  let _settings    = null;
  let _fetchPromise = null;

  // ── DEFAULT built-in config (used before Firestore loads / as fallback) ──
  const DEFAULTS = {
    states: {
      'West Bengal':  [
        { maxWeight: 500,  charge: 40  },
        { maxWeight: 1000, charge: 70  },
        { maxWeight: 2000, charge: 120 }
      ],
      'Odisha':  [
        { maxWeight: 500,  charge: 70  },
        { maxWeight: 1000, charge: 110 },
        { maxWeight: 2000, charge: 180 }
      ],
      'Jharkhand': [
        { maxWeight: 500,  charge: 70  },
        { maxWeight: 1000, charge: 110 },
        { maxWeight: 2000, charge: 180 }
      ],
      'Bihar': [
        { maxWeight: 500,  charge: 70  },
        { maxWeight: 1000, charge: 110 },
        { maxWeight: 2000, charge: 180 }
      ],
      'Assam': [
        { maxWeight: 500,  charge: 80  },
        { maxWeight: 1000, charge: 130 },
        { maxWeight: 2000, charge: 200 }
      ],
      'Maharashtra': [
        { maxWeight: 500,  charge: 100 },
        { maxWeight: 1000, charge: 160 },
        { maxWeight: 2000, charge: 250 }
      ],
      'Delhi': [
        { maxWeight: 500,  charge: 90  },
        { maxWeight: 1000, charge: 145 },
        { maxWeight: 2000, charge: 220 }
      ],
      'Karnataka': [
        { maxWeight: 500,  charge: 110 },
        { maxWeight: 1000, charge: 175 },
        { maxWeight: 2000, charge: 270 }
      ],
      'Tamil Nadu': [
        { maxWeight: 500,  charge: 110 },
        { maxWeight: 1000, charge: 175 },
        { maxWeight: 2000, charge: 270 }
      ],
      'Gujarat': [
        { maxWeight: 500,  charge: 100 },
        { maxWeight: 1000, charge: 160 },
        { maxWeight: 2000, charge: 250 }
      ],
      'Rajasthan': [
        { maxWeight: 500,  charge: 100 },
        { maxWeight: 1000, charge: 160 },
        { maxWeight: 2000, charge: 250 }
      ],
      'Uttar Pradesh': [
        { maxWeight: 500,  charge: 90  },
        { maxWeight: 1000, charge: 145 },
        { maxWeight: 2000, charge: 220 }
      ]
    },
    favourPincodes: {
      '732101': { state: 'West Bengal', charge: 20 },
      '732102': { state: 'West Bengal', charge: 20 },
      '732103': { state: 'West Bengal', charge: 20 }
    },
    defaultCharge: 150
  };

  /**
   * Load shipping settings from Firestore (cached).
   * Returns a Promise that resolves to the settings object.
   * Falls back to DEFAULTS on any error.
   */
  async function loadSettings() {
    if (_settings) return _settings;
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = (async () => {
      try {
        if (!window.db) throw new Error('Firestore not ready');
        const doc = await window.db.collection('shippingSettings').doc('main').get();
        if (doc.exists) {
          const data = doc.data();
          // Merge with defaults so missing keys always have a fallback
          _settings = {
            states:         data.states         || DEFAULTS.states,
            favourPincodes: data.favourPincodes  || DEFAULTS.favourPincodes,
            defaultCharge:  (typeof data.defaultCharge === 'number')
                              ? data.defaultCharge
                              : DEFAULTS.defaultCharge
          };
        } else {
          // Doc doesn't exist yet → seed it and use defaults
          await _seedFirestore();
          _settings = DEFAULTS;
        }
      } catch (e) {
        console.warn('[ShippingEngine] Firestore load failed — using defaults:', e);
        _settings = DEFAULTS;
      }
      return _settings;
    })();

    return _fetchPromise;
  }

  /**
   * Seed Firestore with default config (first run).
   */
  async function _seedFirestore() {
    try {
      await window.db.collection('shippingSettings').doc('main').set(DEFAULTS);
      console.log('[ShippingEngine] Seeded shippingSettings/main with defaults');
    } catch (e) {
      console.warn('[ShippingEngine] Could not seed Firestore:', e);
    }
  }

  /**
   * Normalise state string for case-insensitive matching.
   */
  function _normalise(str) {
    return (str || '').trim().toLowerCase();
  }

  /**
   * Find the matching state key in settings (case-insensitive).
   */
  function _findStateKey(settings, stateName) {
    const n = _normalise(stateName);
    return Object.keys(settings.states).find(k => _normalise(k) === n) || null;
  }

  /**
   * Calculate shipping charge.
   *
   * @param {string}  stateName   - e.g. "West Bengal"
   * @param {string}  pincode     - e.g. "732101"
   * @param {number}  totalWeight - total cart weight in grams
   * @param {object}  [settings]  - pre-loaded settings (optional; falls back to cached)
   * @returns {{ charge: number, label: string, isFavour: boolean }}
   */
  function calculate(stateName, pincode, totalWeight, settings) {
    const cfg    = settings || _settings || DEFAULTS;
    const pin    = (pincode || '').trim();
    const weight = Math.max(0, totalWeight || 0);

    // ── 1. Favour-pincode check ────────────────────────────────────
    const favour = cfg.favourPincodes && cfg.favourPincodes[pin];
    if (favour && _normalise(favour.state) === _normalise(stateName)) {
      return {
        charge:    favour.charge,
        label:     `Local delivery (PIN ${pin})`,
        isFavour:  true
      };
    }

    // ── 2. State-wise weight-slab lookup ──────────────────────────
    const stateKey = _findStateKey(cfg, stateName);
    if (stateKey) {
      const slabs = cfg.states[stateKey];
      // Sort by maxWeight ascending (defensive)
      const sorted = [...slabs].sort((a, b) => a.maxWeight - b.maxWeight);

      for (const slab of sorted) {
        if (weight <= slab.maxWeight) {
          return {
            charge:    slab.charge,
            label:     `${stateKey} (up to ${slab.maxWeight}g)`,
            isFavour:  false
          };
        }
      }

      // Weight exceeds all slabs → use the highest slab charge
      const maxSlab = sorted[sorted.length - 1];
      return {
        charge:    maxSlab.charge,
        label:     `${stateKey} (${weight}g)`,
        isFavour:  false
      };
    }

    // ── 3. Default fallback ───────────────────────────────────────
    return {
      charge:    cfg.defaultCharge,
      label:     stateName ? `${stateName} (standard rate)` : 'Standard shipping',
      isFavour:  false
    };
  }

  /**
   * Calculate total cart weight in grams.
   * Each cart item may have a `weight` field (grams per unit).
   *
   * @param {Array} cartItems
   * @returns {number} total weight in grams
   */
  function cartWeight(cartItems) {
    return cartItems.reduce((sum, item) => {
      const w   = typeof item.weight === 'number' ? item.weight : 0;
      const qty = item.quantity || 1;
      return sum + w * qty;
    }, 0);
  }

  /**
   * Full async calculate — fetches settings if not cached.
   */
  async function calculateAsync(stateName, pincode, totalWeight) {
    const settings = await loadSettings();
    return calculate(stateName, pincode, totalWeight, settings);
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    loadSettings,
    calculate,
    calculateAsync,
    cartWeight,
    /** Expose defaults for admin tooling if needed */
    DEFAULTS
  };

})();
