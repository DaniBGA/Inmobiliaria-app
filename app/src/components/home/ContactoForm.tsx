import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { enviarContacto, type TipoOperacionContacto } from '../../api/contacto';
import { ApiError } from '../../api/client';
import { waLink } from '../../lib/format';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { useContactoInfo } from '../../hooks/useContactoInfo';

export function ContactoForm() {
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();
  const contactoInfo = useContactoInfo();
  const c = contactoInfo.data;
  const infoRows = c
    ? ([
        c.telefono ? { ic: 'T', k: 'Teléfono', v: c.telefono } : null,
        c.email ? { ic: '@', k: 'Email', v: c.email } : null,
        c.direccion ? { ic: 'M', k: 'Oficina', v: c.direccion } : null,
      ].filter(Boolean) as { ic: string; k: string; v: string }[])
    : [];

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacionContacto>('COMPRAR');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: () => enviarContacto({ nombre, telefono: telefono || undefined, email: email || undefined, tipoOperacion, mensaje: mensaje || undefined }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo enviar la consulta. Probá de nuevo.'),
  });

  const puedeEnviar = nombre.trim() && telefono.trim() && email.trim();

  return (
    <section id="contacto" className="section">
      <div className={`container contacto-inner reveal${visible ? ' visible' : ''}`} ref={ref}>
        <div>
          <span className="eyebrow">Contacto</span>
          <h2 className="section-title">Hablemos de tu próximo paso</h2>
          <p className="section-intro">Contanos qué buscás y te respondemos a la brevedad. Sin compromiso.</p>

          <div className="contacto-info-rows">
            {c?.whatsapp && (
              <a
                className="contacto-wa-card"
                href={waLink(c.whatsapp, 'Hola! Quiero hacer una consulta.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="contacto-wa-icon">WA</span>
                <span>
                  <span className="contacto-wa-title">WhatsApp</span>
                  <span className="contacto-wa-sub">Respuesta directa y rápida</span>
                </span>
              </a>
            )}
            {infoRows.map((r) => (
              <div className="contacto-info-row" key={r.k}>
                <span className="contacto-info-icon">{r.ic}</span>
                <span>
                  <span className="contacto-info-k">{r.k}</span>
                  <span className="contacto-info-v">{r.v}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="contacto-form-card">
          {enviar.isSuccess ? (
            <div className="okstate">
              <div className="okstate-check">✓</div>
              <h3>¡Consulta enviada!</h3>
              <p>Te vamos a responder a la brevedad.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar.mutate();
              }}
            >
              {error && <div className="errstate">{error}</div>}
              <div className="fg">
                <label>Nombre completo</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="fg">
                <label>Teléfono</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
              </div>
              <div className="fg">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="fg">
                <label>Tipo de operación</label>
                <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value as TipoOperacionContacto)}>
                  <option value="COMPRAR">Comprar</option>
                  <option value="VENDER">Vender</option>
                  <option value="ALQUILAR">Alquilar</option>
                </select>
              </div>
              <div className="fg">
                <label>Mensaje</label>
                <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!puedeEnviar || enviar.isPending}>
                {enviar.isPending ? 'Enviando…' : 'Enviar consulta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
