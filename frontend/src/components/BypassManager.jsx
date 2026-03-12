/**
 * BypassManager - Componente para gestionar reglas de bypass del proxy
 * Permite excluir URLs (con regex) para que no pasen por el proxy MITM
 * Útil para sitios como Google reCAPTCHA que no confían en certificados MITM
 */

const { useState, useEffect } = React;
import { useBypass } from '../hooks/useBypass.js';

export function BypassManager({ toast }) {
  const {
    rules,
    presets,
    status,
    loading,
    loadRules,
    loadPresets,
    loadStatus,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    applyPreset
  } = useBypass(toast);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    pattern: '',
    is_regex: false,
    description: '',
    enabled: true
  });

  // Load data on mount
  useEffect(() => {
    loadRules();
    loadPresets();
    loadStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.pattern.trim()) {
      toast('Pattern is required', 'error');
      return;
    }

    if (editingRule) {
      await updateRule(editingRule.id, formData);
      setEditingRule(null);
    } else {
      await createRule(formData);
    }

    // Reset form
    setFormData({
      pattern: '',
      is_regex: false,
      description: '',
      enabled: true
    });
    setShowAddForm(false);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      pattern: rule.pattern,
      is_regex: rule.is_regex,
      description: rule.description || '',
      enabled: rule.enabled
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this bypass rule?')) {
      await deleteRule(id);
    }
  };

  const handleApplyPreset = async (presetName) => {
    if (confirm(`Apply ${presetName} preset? This will add multiple rules.`)) {
      await applyPreset(presetName);
      setShowPresets(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingRule(null);
    setFormData({
      pattern: '',
      is_regex: false,
      description: '',
      enabled: true
    });
  };

  return React.createElement('div', {
    className: 'bypass-manager',
    style: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }
  },
    // Header
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '2px solid var(--border, #444)',
        paddingBottom: '12px'
      }
    },
      React.createElement('div', null,
        React.createElement('h2', {
          style: { margin: '0 0 8px 0', fontSize: '24px', color: 'var(--text, #eee)' }
        }, '🚫 Proxy Bypass Rules'),
        React.createElement('p', {
          style: { margin: 0, fontSize: '13px', color: 'var(--text-muted, #888)' }
        }, 'Exclude URLs from MITM interception (useful for Google reCAPTCHA, certificates, etc.)')
      ),
      React.createElement('div', {
        style: { display: 'flex', gap: '8px' }
      },
        React.createElement('button', {
          onClick: () => setShowPresets(!showPresets),
          style: {
            padding: '8px 16px',
            background: 'var(--secondary, #555)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }
        }, '📋 Presets'),
        React.createElement('button', {
          onClick: () => setShowAddForm(!showAddForm),
          style: {
            padding: '8px 16px',
            background: 'var(--primary, #4a9eff)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }
        }, showAddForm ? 'Cancel' : '➕ Add Rule')
      )
    ),

    // Status Banner
    status && React.createElement('div', {
      style: {
        padding: '12px 16px',
        background: status.status === 'active' ? 'var(--success-bg, #1a3a1a)' : 'var(--warning-bg, #3a3a1a)',
        border: `1px solid ${status.status === 'active' ? 'var(--success, #4a9)' : 'var(--warning, #fa4)'}`,
        borderRadius: '6px',
        marginBottom: '20px',
        fontSize: '13px'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      },
        React.createElement('span', null,
          status.status === 'active'
            ? `✅ Bypass active: ${status.enabled_rules_count} rules enabled`
            : '⚠️ No bypass rules enabled'
        ),
        status.status === 'active' && React.createElement('span', {
          style: {
            fontSize: '11px',
            color: 'var(--text-muted, #888)'
          }
        }, '⚡ Restart proxy to apply changes')
      )
    ),

    // Presets Panel
    showPresets && React.createElement('div', {
      style: {
        padding: '16px',
        background: 'var(--bg-secondary, #222)',
        border: '1px solid var(--border, #444)',
        borderRadius: '6px',
        marginBottom: '20px'
      }
    },
      React.createElement('h3', {
        style: { margin: '0 0 16px 0', fontSize: '16px' }
      }, 'Quick Presets'),
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px'
        }
      },
        Object.entries(presets).map(([name, rules]) =>
          React.createElement('div', {
            key: name,
            style: {
              padding: '12px',
              background: 'var(--bg, #1a1a1a)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px'
            }
          },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }
            },
              React.createElement('span', {
                style: { fontWeight: '600', textTransform: 'capitalize' }
              }, name),
              React.createElement('span', {
                style: {
                  fontSize: '11px',
                  padding: '2px 6px',
                  background: 'var(--accent-bg, #2a2a2a)',
                  borderRadius: '3px'
                }
              }, `${rules.length} rules`)
            ),
            React.createElement('div', {
              style: {
                fontSize: '12px',
                color: 'var(--text-muted, #888)',
                marginBottom: '8px'
              }
            }, rules.map(r => r.description).join(', ')),
            React.createElement('button', {
              onClick: () => handleApplyPreset(name),
              disabled: loading,
              style: {
                width: '100%',
                padding: '6px',
                background: 'var(--primary, #4a9eff)',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '12px'
              }
            }, 'Apply Preset')
          )
        )
      )
    ),

    // Add/Edit Form
    showAddForm && React.createElement('form', {
      onSubmit: handleSubmit,
      style: {
        padding: '16px',
        background: 'var(--bg-secondary, #222)',
        border: '1px solid var(--border, #444)',
        borderRadius: '6px',
        marginBottom: '20px'
      }
    },
      React.createElement('h3', {
        style: { margin: '0 0 16px 0', fontSize: '16px' }
      }, editingRule ? 'Edit Bypass Rule' : 'Add Bypass Rule'),

      // Pattern input
      React.createElement('div', { style: { marginBottom: '12px' } },
        React.createElement('label', {
          style: {
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500'
          }
        }, 'Pattern'),
        React.createElement('input', {
          type: 'text',
          value: formData.pattern,
          onChange: (e) => setFormData({ ...formData, pattern: e.target.value }),
          placeholder: '*.google.com or ^.*\\.google\\.com$',
          required: true,
          style: {
            width: '100%',
            padding: '8px 12px',
            background: 'var(--bg, #1a1a1a)',
            border: '1px solid var(--border, #444)',
            borderRadius: '4px',
            color: 'var(--text, #eee)',
            fontSize: '13px',
            fontFamily: 'monospace'
          }
        }),
        React.createElement('small', {
          style: {
            display: 'block',
            marginTop: '4px',
            fontSize: '11px',
            color: 'var(--text-muted, #888)'
          }
        }, 'Use * for wildcard (*.google.com) or enable regex for complex patterns')
      ),

      // Regex checkbox
      React.createElement('div', {
        style: {
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        React.createElement('input', {
          type: 'checkbox',
          id: 'is-regex',
          checked: formData.is_regex,
          onChange: (e) => setFormData({ ...formData, is_regex: e.target.checked })
        }),
        React.createElement('label', {
          htmlFor: 'is-regex',
          style: { fontSize: '13px', cursor: 'pointer' }
        }, 'Use Regular Expression')
      ),

      // Description
      React.createElement('div', { style: { marginBottom: '16px' } },
        React.createElement('label', {
          style: {
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500'
          }
        }, 'Description (optional)'),
        React.createElement('input', {
          type: 'text',
          value: formData.description,
          onChange: (e) => setFormData({ ...formData, description: e.target.value }),
          placeholder: 'e.g., Google reCAPTCHA domains',
          style: {
            width: '100%',
            padding: '8px 12px',
            background: 'var(--bg, #1a1a1a)',
            border: '1px solid var(--border, #444)',
            borderRadius: '4px',
            color: 'var(--text, #eee)',
            fontSize: '13px'
          }
        })
      ),

      // Buttons
      React.createElement('div', {
        style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' }
      },
        React.createElement('button', {
          type: 'button',
          onClick: cancelForm,
          style: {
            padding: '8px 16px',
            background: 'var(--secondary, #555)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }
        }, 'Cancel'),
        React.createElement('button', {
          type: 'submit',
          disabled: loading,
          style: {
            padding: '8px 16px',
            background: 'var(--primary, #4a9eff)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }
        }, editingRule ? 'Update' : 'Add Rule')
      )
    ),

    // Rules List
    React.createElement('div', {
      style: {
        background: 'var(--bg-secondary, #222)',
        border: '1px solid var(--border, #444)',
        borderRadius: '6px',
        overflow: 'hidden'
      }
    },
      React.createElement('div', {
        style: {
          padding: '12px 16px',
          borderBottom: '1px solid var(--border, #444)',
          background: 'var(--bg, #1a1a1a)',
          fontWeight: '600',
          fontSize: '13px'
        }
      }, `Bypass Rules (${rules.length})`),

      rules.length === 0 ? React.createElement('div', {
        style: {
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted, #888)',
          fontSize: '13px'
        }
      },
        '📝 No bypass rules configured',
        React.createElement('br'),
        React.createElement('small', null, 'Add rules to exclude URLs from MITM interception')
      ) : React.createElement('div', null,
        rules.map(rule =>
          React.createElement('div', {
            key: rule.id,
            style: {
              padding: '12px 16px',
              borderBottom: '1px solid var(--border, #444)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: rule.enabled ? 'transparent' : 'var(--bg, #1a1a1a)',
              opacity: rule.enabled ? 1 : 0.6
            }
          },
            // Toggle checkbox
            React.createElement('input', {
              type: 'checkbox',
              checked: rule.enabled,
              onChange: () => toggleRule(rule.id),
              style: { cursor: 'pointer' }
            }),

            // Rule info
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }
              },
                React.createElement('code', {
                  style: {
                    padding: '2px 6px',
                    background: 'var(--accent-bg, #2a2a2a)',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }
                }, rule.pattern),
                rule.is_regex && React.createElement('span', {
                  style: {
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: 'var(--primary, #4a9eff)',
                    color: '#fff',
                    borderRadius: '3px',
                    fontWeight: '600'
                  }
                }, 'REGEX')
              ),
              rule.description && React.createElement('div', {
                style: {
                  fontSize: '11px',
                  color: 'var(--text-muted, #888)'
                }
              }, rule.description)
            ),

            // Actions
            React.createElement('div', {
              style: { display: 'flex', gap: '8px' }
            },
              React.createElement('button', {
                onClick: () => handleEdit(rule),
                style: {
                  padding: '4px 8px',
                  background: 'var(--secondary, #555)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }
              }, 'Edit'),
              React.createElement('button', {
                onClick: () => handleDelete(rule.id),
                style: {
                  padding: '4px 8px',
                  background: 'var(--error, #a44)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }
              }, 'Delete')
            )
          )
        )
      )
    ),

    // Help Section
    React.createElement('div', {
      style: {
        marginTop: '20px',
        padding: '16px',
        background: 'var(--accent-bg, #2a2a2a)',
        border: '1px solid var(--border, #444)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--text-muted, #888)'
      }
    },
      React.createElement('strong', {
        style: { color: 'var(--text, #eee)', display: 'block', marginBottom: '8px' }
      }, '💡 How it works:'),
      React.createElement('ul', {
        style: { margin: '0', paddingLeft: '20px' }
      },
        React.createElement('li', null, 'Bypass rules exclude URLs from MITM SSL interception'),
        React.createElement('li', null, 'Use wildcards like *.google.com for simple patterns'),
        React.createElement('li', null, 'Enable regex for complex patterns like ^(.*\\.)?google\\.com$'),
        React.createElement('li', null, 'Changes require proxy restart to take effect'),
        React.createElement('li', null, 'Useful for sites with certificate pinning (Google, CloudFlare, etc.)')
      )
    )
  );
}
