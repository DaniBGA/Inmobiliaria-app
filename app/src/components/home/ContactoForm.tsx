import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enviarContacto, type TipoOperacionContacto } from '../../api/contacto';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { ApiError } from '../../api/client';
import { waLink } from '../../lib/format';

export function ContactoForm() {
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

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
      <div className="container contacto-inner">
        <div>
          <span className="eyebrow">Contacto</span>
          <h2 className="section-title">Conversemos sobre tu propiedad</h2>
          <p className="section-intro">
            Escribinos por WhatsApp o dejanos tu consulta y te contactamos a la brevedad.
          </p>
          {contactoInfo.data?.whatsapp && (
            <a
              className="btn btn-whatsapp"
              style={{ marginTop: 24 }}
              href={waLink(contactoInfo.data.whatsapp, 'Hola! Quiero hacer una consulta.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>

        <div className="contacto-form-card">
          {enviar.isSuccess ? (
            <div className="okstate">
              <h3>¡Gracias! Recibimos tu consulta</h3>
              <p>Te vamos a contactar a la brevedad.</p>
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
