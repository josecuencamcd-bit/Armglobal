export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aportes: {
        Row: {
          campus: Database["public"]["Enums"]["campus_t"]
          categoria: Database["public"]["Enums"]["categoria_aporte_t"]
          creado_en: string
          encuentro: string | null
          evento: string | null
          fecha: string
          hora: string | null
          id: string
          metodo: Database["public"]["Enums"]["metodo_pago_t"]
          monto: number
          nombre: string | null
          registrado_por: string | null
          sesion_key: string | null
        }
        Insert: {
          campus: Database["public"]["Enums"]["campus_t"]
          categoria: Database["public"]["Enums"]["categoria_aporte_t"]
          creado_en?: string
          encuentro?: string | null
          evento?: string | null
          fecha: string
          hora?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["metodo_pago_t"]
          monto: number
          nombre?: string | null
          registrado_por?: string | null
          sesion_key?: string | null
        }
        Update: {
          campus?: Database["public"]["Enums"]["campus_t"]
          categoria?: Database["public"]["Enums"]["categoria_aporte_t"]
          creado_en?: string
          encuentro?: string | null
          evento?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pago_t"]
          monto?: number
          nombre?: string | null
          registrado_por?: string | null
          sesion_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aportes_sesion_key_fkey"
            columns: ["sesion_key"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["key"]
          },
        ]
      }
      autorizaciones_encuentro: {
        Row: {
          campus: Database["public"]["Enums"]["campus_t"]
          correo: string
          encuentro: string | null
          estado: string
          fecha: string | null
          id: number
          motivo: string | null
          nombre: string | null
          pedido: string
          resuelto_por: string | null
          sesion_key: string | null
          vence: string | null
        }
        Insert: {
          campus: Database["public"]["Enums"]["campus_t"]
          correo: string
          encuentro?: string | null
          estado?: string
          fecha?: string | null
          id?: never
          motivo?: string | null
          nombre?: string | null
          pedido?: string
          resuelto_por?: string | null
          sesion_key?: string | null
          vence?: string | null
        }
        Update: {
          campus?: Database["public"]["Enums"]["campus_t"]
          correo?: string
          encuentro?: string | null
          estado?: string
          fecha?: string | null
          id?: never
          motivo?: string | null
          nombre?: string | null
          pedido?: string
          resuelto_por?: string | null
          sesion_key?: string | null
          vence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizaciones_encuentro_sesion_key_fkey"
            columns: ["sesion_key"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["key"]
          },
        ]
      }
      autorizaciones_fondos: {
        Row: {
          admin: string | null
          admin_en: string | null
          area: string
          campus: Database["public"]["Enums"]["campus_t"]
          correo: string | null
          estado: string
          id: number
          mes: string
          motivo: string | null
          pastor: string | null
          pastor_en: string | null
          pedido: string
          rechazo: string | null
          solicitante: string | null
          vence: string | null
        }
        Insert: {
          admin?: string | null
          admin_en?: string | null
          area: string
          campus: Database["public"]["Enums"]["campus_t"]
          correo?: string | null
          estado?: string
          id?: never
          mes: string
          motivo?: string | null
          pastor?: string | null
          pastor_en?: string | null
          pedido?: string
          rechazo?: string | null
          solicitante?: string | null
          vence?: string | null
        }
        Update: {
          admin?: string | null
          admin_en?: string | null
          area?: string
          campus?: Database["public"]["Enums"]["campus_t"]
          correo?: string | null
          estado?: string
          id?: never
          mes?: string
          motivo?: string | null
          pastor?: string | null
          pastor_en?: string | null
          pedido?: string
          rechazo?: string | null
          solicitante?: string | null
          vence?: string | null
        }
        Relationships: []
      }
      avisos_vigilante: {
        Row: {
          key: string
          tipo: string
          ultimo: string | null
          veces: number
        }
        Insert: {
          key: string
          tipo: string
          ultimo?: string | null
          veces?: number
        }
        Update: {
          key?: string
          tipo?: string
          ultimo?: string | null
          veces?: number
        }
        Relationships: []
      }
      ayuda: {
        Row: {
          correo: string
          estado: string
          fecha: string
          id: number
          mensaje: string
          nombre: string | null
          perfil: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          tipo: string | null
        }
        Insert: {
          correo: string
          estado?: string
          fecha?: string
          id?: never
          mensaje: string
          nombre?: string | null
          perfil?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: string | null
        }
        Update: {
          correo?: string
          estado?: string
          fecha?: string
          id?: never
          mensaje?: string
          nombre?: string | null
          perfil?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      cierres_mes: {
        Row: {
          area: string
          automatico: boolean
          campus: Database["public"]["Enums"]["campus_t"]
          cuando: string
          id: number
          mes: string
          por: string | null
        }
        Insert: {
          area: string
          automatico?: boolean
          campus: Database["public"]["Enums"]["campus_t"]
          cuando?: string
          id?: never
          mes: string
          por?: string | null
        }
        Update: {
          area?: string
          automatico?: boolean
          campus?: Database["public"]["Enums"]["campus_t"]
          cuando?: string
          id?: never
          mes?: string
          por?: string | null
        }
        Relationships: []
      }
      cumple_propuestas: {
        Row: {
          abrazo: string | null
          creada_en: string
          enviada_en: string | null
          estado: string
          fecha: string
          gracias: string | null
          id: number
          mensaje: string | null
          nombres: string
          recordada_en: string | null
          resuelta_en: string | null
          saludo: string | null
          semilla: string | null
          versiculo: string | null
        }
        Insert: {
          abrazo?: string | null
          creada_en?: string
          enviada_en?: string | null
          estado?: string
          fecha: string
          gracias?: string | null
          id?: never
          mensaje?: string | null
          nombres: string
          recordada_en?: string | null
          resuelta_en?: string | null
          saludo?: string | null
          semilla?: string | null
          versiculo?: string | null
        }
        Update: {
          abrazo?: string | null
          creada_en?: string
          enviada_en?: string | null
          estado?: string
          fecha?: string
          gracias?: string | null
          id?: never
          mensaje?: string | null
          nombres?: string
          recordada_en?: string | null
          resuelta_en?: string | null
          saludo?: string | null
          semilla?: string | null
          versiculo?: string | null
        }
        Relationships: []
      }
      fechas_encuentro: {
        Row: {
          activo: boolean
          actualizado: string
          campus: Database["public"]["Enums"]["campus_t"]
          fecha: string
          por: string | null
        }
        Insert: {
          activo?: boolean
          actualizado?: string
          campus: Database["public"]["Enums"]["campus_t"]
          fecha: string
          por?: string | null
        }
        Update: {
          activo?: boolean
          actualizado?: string
          campus?: Database["public"]["Enums"]["campus_t"]
          fecha?: string
          por?: string | null
        }
        Relationships: []
      }
      fichas_servicio: {
        Row: {
          actualizado: string
          area: string
          encargado: string | null
          fecha: string
          id: number
          nombre: string | null
          puesto: string
          servicio: string
          tipo: string
        }
        Insert: {
          actualizado?: string
          area: string
          encargado?: string | null
          fecha: string
          id?: never
          nombre?: string | null
          puesto: string
          servicio: string
          tipo?: string
        }
        Update: {
          actualizado?: string
          area?: string
          encargado?: string | null
          fecha?: string
          id?: never
          nombre?: string | null
          puesto?: string
          servicio?: string
          tipo?: string
        }
        Relationships: []
      }
      fondos_equipo: {
        Row: {
          anulado_en: string | null
          anulado_por: string | null
          area: Database["public"]["Enums"]["area_t"]
          boleta: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          categoria: string | null
          comercio: string | null
          creado_en: string
          descripcion: string | null
          estado: string
          fecha: string
          foto_url: string | null
          id: number
          metodo: string | null
          monto: number
          motivo: string | null
          nombre: string | null
          por: string | null
          tardio: boolean
          tipo: string
        }
        Insert: {
          anulado_en?: string | null
          anulado_por?: string | null
          area: Database["public"]["Enums"]["area_t"]
          boleta?: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          categoria?: string | null
          comercio?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha: string
          foto_url?: string | null
          id?: never
          metodo?: string | null
          monto: number
          motivo?: string | null
          nombre?: string | null
          por?: string | null
          tardio?: boolean
          tipo: string
        }
        Update: {
          anulado_en?: string | null
          anulado_por?: string | null
          area?: Database["public"]["Enums"]["area_t"]
          boleta?: string | null
          campus?: Database["public"]["Enums"]["campus_t"]
          categoria?: string | null
          comercio?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha?: string
          foto_url?: string | null
          id?: never
          metodo?: string | null
          monto?: number
          motivo?: string | null
          nombre?: string | null
          por?: string | null
          tardio?: boolean
          tipo?: string
        }
        Relationships: []
      }
      gastos_campus: {
        Row: {
          anulado_en: string | null
          anulado_por: string | null
          boleta: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          comercio: string | null
          creado_en: string
          descripcion: string | null
          estado: string
          fecha: string
          foto_url: string | null
          id: number
          item: string
          monto: number
          motivo: string | null
          por: string | null
          tardio: boolean
        }
        Insert: {
          anulado_en?: string | null
          anulado_por?: string | null
          boleta?: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          comercio?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha: string
          foto_url?: string | null
          id?: never
          item: string
          monto: number
          motivo?: string | null
          por?: string | null
          tardio?: boolean
        }
        Update: {
          anulado_en?: string | null
          anulado_por?: string | null
          boleta?: string | null
          campus?: Database["public"]["Enums"]["campus_t"]
          comercio?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha?: string
          foto_url?: string | null
          id?: never
          item?: string
          monto?: number
          motivo?: string | null
          por?: string | null
          tardio?: boolean
        }
        Relationships: []
      }
      integrante_seguimiento: {
        Row: {
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          creado_en: string
          estado: string | null
          fecha: string
          id: number
          integrante_id: number | null
          marcado_por: string | null
          nombre: string | null
          observacion: string | null
          respuesta: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          creado_en?: string
          estado?: string | null
          fecha: string
          id?: never
          integrante_id?: number | null
          marcado_por?: string | null
          nombre?: string | null
          observacion?: string | null
          respuesta?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_t"]
          campus?: Database["public"]["Enums"]["campus_t"]
          creado_en?: string
          estado?: string | null
          fecha?: string
          id?: never
          integrante_id?: number | null
          marcado_por?: string | null
          nombre?: string | null
          observacion?: string | null
          respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrante_seguimiento_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes"
            referencedColumns: ["id"]
          },
        ]
      }
      integrantes: {
        Row: {
          anos_iglesia: number | null
          anos_servicio: number | null
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          correo: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          id: number
          nacimiento: string | null
          nombre: string
          profesion: string | null
          rol_servicio: string | null
          telefono: string | null
        }
        Insert: {
          anos_iglesia?: number | null
          anos_servicio?: number | null
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          correo?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: never
          nacimiento?: string | null
          nombre: string
          profesion?: string | null
          rol_servicio?: string | null
          telefono?: string | null
        }
        Update: {
          anos_iglesia?: number | null
          anos_servicio?: number | null
          area?: Database["public"]["Enums"]["area_t"]
          campus?: Database["public"]["Enums"]["campus_t"]
          correo?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: never
          nacimiento?: string | null
          nombre?: string
          profesion?: string | null
          rol_servicio?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      nombres_modulo: {
        Row: {
          actualizado: string
          clave: string
          nombre: string
          por: string | null
        }
        Insert: {
          actualizado?: string
          clave: string
          nombre: string
          por?: string | null
        }
        Update: {
          actualizado?: string
          clave?: string
          nombre?: string
          por?: string | null
        }
        Relationships: []
      }
      notas: {
        Row: {
          actualizado: string
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          fecha: string
          finalizado: boolean
          hora: string | null
          key: string
          nota: string | null
          por: string | null
        }
        Insert: {
          actualizado?: string
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          fecha: string
          finalizado?: boolean
          hora?: string | null
          key: string
          nota?: string | null
          por?: string | null
        }
        Update: {
          actualizado?: string
          area?: Database["public"]["Enums"]["area_t"]
          campus?: Database["public"]["Enums"]["campus_t"]
          fecha?: string
          finalizado?: boolean
          hora?: string | null
          key?: string
          nota?: string | null
          por?: string | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          actualizado_en: string
          areas: Database["public"]["Enums"]["area_t"][]
          areas_nuevas: Database["public"]["Enums"]["area_t"][] | null
          bloqueado: boolean
          campus: Database["public"]["Enums"]["campus_t"] | null
          correo: string
          creado_en: string
          foto_url: string | null
          id: string
          modulos_off: string[]
          modulos_on: string[]
          nacimiento: string | null
          nombre: string
          rol_cambia_desde: string | null
          roles: Database["public"]["Enums"]["rol_t"][]
          roles_nuevos: Database["public"]["Enums"]["rol_t"][] | null
          sirve: Database["public"]["Enums"]["area_t"][]
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          areas?: Database["public"]["Enums"]["area_t"][]
          areas_nuevas?: Database["public"]["Enums"]["area_t"][] | null
          bloqueado?: boolean
          campus?: Database["public"]["Enums"]["campus_t"] | null
          correo: string
          creado_en?: string
          foto_url?: string | null
          id: string
          modulos_off?: string[]
          modulos_on?: string[]
          nacimiento?: string | null
          nombre: string
          rol_cambia_desde?: string | null
          roles?: Database["public"]["Enums"]["rol_t"][]
          roles_nuevos?: Database["public"]["Enums"]["rol_t"][] | null
          sirve?: Database["public"]["Enums"]["area_t"][]
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          areas?: Database["public"]["Enums"]["area_t"][]
          areas_nuevas?: Database["public"]["Enums"]["area_t"][] | null
          bloqueado?: boolean
          campus?: Database["public"]["Enums"]["campus_t"] | null
          correo?: string
          creado_en?: string
          foto_url?: string | null
          id?: string
          modulos_off?: string[]
          modulos_on?: string[]
          nacimiento?: string | null
          nombre?: string
          rol_cambia_desde?: string | null
          roles?: Database["public"]["Enums"]["rol_t"][]
          roles_nuevos?: Database["public"]["Enums"]["rol_t"][] | null
          sirve?: Database["public"]["Enums"]["area_t"][]
          telefono?: string | null
        }
        Relationships: []
      }
      reuniones: {
        Row: {
          correo: string
          creado_en: string
          duracion: number | null
          estado: string
          evento: string | null
          fecha: string
          hora: string | null
          id: number
          invitados: string | null
          lugar: string | null
          notas: string | null
          organizador: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          correo: string
          creado_en?: string
          duracion?: number | null
          estado?: string
          evento?: string | null
          fecha: string
          hora?: string | null
          id?: never
          invitados?: string | null
          lugar?: string | null
          notas?: string | null
          organizador?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          correo?: string
          creado_en?: string
          duracion?: number | null
          estado?: string
          evento?: string | null
          fecha?: string
          hora?: string | null
          id?: never
          invitados?: string | null
          lugar?: string | null
          notas?: string | null
          organizador?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: []
      }
      sesion_asistencia: {
        Row: {
          area: string
          cantidad: number
          sesion_key: string
        }
        Insert: {
          area: string
          cantidad?: number
          sesion_key: string
        }
        Update: {
          area?: string
          cantidad?: number
          sesion_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_asistencia_sesion_key_fkey"
            columns: ["sesion_key"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["key"]
          },
        ]
      }
      sesion_voluntarios: {
        Row: {
          area: string
          cantidad: number
          sesion_key: string
        }
        Insert: {
          area: string
          cantidad?: number
          sesion_key: string
        }
        Update: {
          area?: string
          cantidad?: number
          sesion_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_voluntarios_sesion_key_fkey"
            columns: ["sesion_key"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["key"]
          },
        ]
      }
      sesiones: {
        Row: {
          aceptaron: number | null
          actualizado: string
          adm: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          editado_por: string | null
          encuentro: string
          evento: string | null
          fecha: string
          finalizado: boolean
          fotos: string[] | null
          key: string
          lideres: string | null
          mensaje: string | null
          modalidad: Database["public"]["Enums"]["modalidad_t"] | null
          on_acepto: number | null
          on_espect: number | null
          predicador: string | null
          responsable: string | null
        }
        Insert: {
          aceptaron?: number | null
          actualizado?: string
          adm?: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          editado_por?: string | null
          encuentro: string
          evento?: string | null
          fecha: string
          finalizado?: boolean
          fotos?: string[] | null
          key: string
          lideres?: string | null
          mensaje?: string | null
          modalidad?: Database["public"]["Enums"]["modalidad_t"] | null
          on_acepto?: number | null
          on_espect?: number | null
          predicador?: string | null
          responsable?: string | null
        }
        Update: {
          aceptaron?: number | null
          actualizado?: string
          adm?: string | null
          campus?: Database["public"]["Enums"]["campus_t"]
          editado_por?: string | null
          encuentro?: string
          evento?: string | null
          fecha?: string
          finalizado?: boolean
          fotos?: string[] | null
          key?: string
          lideres?: string | null
          mensaje?: string | null
          modalidad?: Database["public"]["Enums"]["modalidad_t"] | null
          on_acepto?: number | null
          on_espect?: number | null
          predicador?: string | null
          responsable?: string | null
        }
        Relationships: []
      }
      solicitudes_acceso: {
        Row: {
          correo: string
          estado: string
          fecha: string
          huella: string | null
          nombre: string | null
          nota: string | null
          resuelto_en: string | null
          resuelto_por: string | null
        }
        Insert: {
          correo: string
          estado?: string
          fecha?: string
          huella?: string | null
          nombre?: string | null
          nota?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Update: {
          correo?: string
          estado?: string
          fecha?: string
          huella?: string | null
          nombre?: string | null
          nota?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Relationships: []
      }
      solicitudes_baja: {
        Row: {
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          estado: string
          fecha: string
          id: number
          integrante_id: number | null
          motivo: string | null
          nombre: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          solicitante: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_t"]
          campus: Database["public"]["Enums"]["campus_t"]
          estado?: string
          fecha?: string
          id?: never
          integrante_id?: number | null
          motivo?: string | null
          nombre?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          solicitante?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_t"]
          campus?: Database["public"]["Enums"]["campus_t"]
          estado?: string
          fecha?: string
          id?: never
          integrante_id?: number | null
          motivo?: string | null
          nombre?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          solicitante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_baja_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          actualizado: string
          campus: Database["public"]["Enums"]["campus_t"]
          correos: string[] | null
          nombres: string[] | null
          por: string | null
          semana: string
        }
        Insert: {
          actualizado?: string
          campus: Database["public"]["Enums"]["campus_t"]
          correos?: string[] | null
          nombres?: string[] | null
          por?: string | null
          semana: string
        }
        Update: {
          actualizado?: string
          campus?: Database["public"]["Enums"]["campus_t"]
          correos?: string[] | null
          nombres?: string[] | null
          por?: string | null
          semana?: string
        }
        Relationships: []
      }
      visitas: {
        Row: {
          actualizado_en: string | null
          actualizado_por: string | null
          asignado_correo: string | null
          asignado_nombre: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          creado_en: string
          creado_por: string | null
          creado_por_correo: string | null
          estado: Database["public"]["Enums"]["estado_visita_t"]
          id: number
          nombre: string
          nota: string | null
          proximo: string | null
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string | null
          actualizado_por?: string | null
          asignado_correo?: string | null
          asignado_nombre?: string | null
          campus: Database["public"]["Enums"]["campus_t"]
          creado_en?: string
          creado_por?: string | null
          creado_por_correo?: string | null
          estado?: Database["public"]["Enums"]["estado_visita_t"]
          id?: never
          nombre: string
          nota?: string | null
          proximo?: string | null
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string | null
          actualizado_por?: string | null
          asignado_correo?: string | null
          asignado_nombre?: string | null
          campus?: Database["public"]["Enums"]["campus_t"]
          creado_en?: string
          creado_por?: string | null
          creado_por_correo?: string | null
          estado?: Database["public"]["Enums"]["estado_visita_t"]
          id?: never
          nombre?: string
          nota?: string | null
          proximo?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      visitas_historial: {
        Row: {
          asignado_a: string | null
          correo: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_visita_t"] | null
          fecha: string
          id: number
          nota: string | null
          por: string | null
          proximo: string | null
          tipo: string | null
          visita_id: number
        }
        Insert: {
          asignado_a?: string | null
          correo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_visita_t"] | null
          fecha?: string
          id?: never
          nota?: string | null
          por?: string | null
          proximo?: string | null
          tipo?: string | null
          visita_id: number
        }
        Update: {
          asignado_a?: string | null
          correo?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_visita_t"] | null
          fecha?: string
          id?: never
          nota?: string | null
          por?: string | null
          proximo?: string | null
          tipo?: string | null
          visita_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "visitas_historial_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_roles_programados: { Args: never; Returns: number }
      auth_areas: {
        Args: never
        Returns: Database["public"]["Enums"]["area_t"][]
      }
      auth_autorizado: { Args: { skey: string }; Returns: boolean }
      auth_campus: {
        Args: never
        Returns: Database["public"]["Enums"]["campus_t"]
      }
      auth_es_admin_app: { Args: never; Returns: boolean }
      auth_es_alto: { Args: never; Returns: boolean }
      auth_es_finanzas: { Args: never; Returns: boolean }
      auth_es_pastor: { Args: never; Returns: boolean }
      auth_sirve: {
        Args: never
        Returns: Database["public"]["Enums"]["area_t"][]
      }
      auth_tiene_rol: {
        Args: { r: Database["public"]["Enums"]["rol_t"] }
        Returns: boolean
      }
      auth_ve_campus: {
        Args: { c: Database["public"]["Enums"]["campus_t"] }
        Returns: boolean
      }
      auth_ve_todo_campus: { Args: never; Returns: boolean }
    }
    Enums: {
      area_t:
        | "Kids"
        | "Tweens"
        | "Técnica"
        | "Worship"
        | "Conexión"
        | "Voluntariado"
        | "Stand de Oración"
        | "Campus"
      campus_t: "Punta Arenas" | "Puerto Natales"
      categoria_aporte_t:
        | "Ofrenda"
        | "Siembra Especial"
        | "Diezmo"
        | "Amor por la Casa"
      estado_asistencia_t: "Vino" | "No vino" | "Avisó"
      estado_visita_t:
        | "Pendiente"
        | "Contactado"
        | "Agendado"
        | "Reunido"
        | "Sin respuesta"
      metodo_pago_t: "Tarjeta" | "Efectivo" | "Transferencia"
      modalidad_t: "Presencial" | "Virtual"
      rol_t:
        | "Pastor principal"
        | "Pastor de campus"
        | "Pastor"
        | "Ministro"
        | "Administrador"
        | "Líder"
        | "Voluntario"
        | "Admin app"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      area_t: [
        "Kids",
        "Tweens",
        "Técnica",
        "Worship",
        "Conexión",
        "Voluntariado",
        "Stand de Oración",
        "Campus",
      ],
      campus_t: ["Punta Arenas", "Puerto Natales"],
      categoria_aporte_t: [
        "Ofrenda",
        "Siembra Especial",
        "Diezmo",
        "Amor por la Casa",
      ],
      estado_asistencia_t: ["Vino", "No vino", "Avisó"],
      estado_visita_t: [
        "Pendiente",
        "Contactado",
        "Agendado",
        "Reunido",
        "Sin respuesta",
      ],
      metodo_pago_t: ["Tarjeta", "Efectivo", "Transferencia"],
      modalidad_t: ["Presencial", "Virtual"],
      rol_t: [
        "Pastor principal",
        "Pastor de campus",
        "Pastor",
        "Ministro",
        "Administrador",
        "Líder",
        "Voluntario",
        "Admin app",
      ],
    },
  },
} as const
