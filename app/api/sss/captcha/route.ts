import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const SSS_BASE = 'https://www.sssalud.gob.ar'
const SSS_PAGE = `${SSS_BASE}/index.php?user=GRAL&page=bus650`

/**
 * GET /api/sss/captcha
 *
 * Obtiene un CAPTCHA fresco desde sssalud.gob.ar:
 * 1. Carga la página del formulario → captura PHPSESSID + sid del CAPTCHA
 * 2. Descarga la imagen del CAPTCHA usando la misma sesión PHP
 * 3. Devuelve la imagen en base64 + tokens de sesión para la consulta posterior
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // ── 1. Cargar la página del formulario ────────────────────────────────────
    const pageRes = await fetch(SSS_PAGE, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (!pageRes.ok) {
      throw new Error(`SSS página respondió ${pageRes.status}`)
    }

    const html = await pageRes.text()

    // Extraer PHPSESSID de la cabecera Set-Cookie
    const rawCookies = pageRes.headers.getSetCookie?.() ?? []
    const allCookieHeader = pageRes.headers.get('set-cookie') ?? ''
    const phpSessMatch =
      rawCookies
        .map((c) => c.match(/PHPSESSID=([^;]+)/i))
        .find(Boolean) ??
      allCookieHeader.match(/PHPSESSID=([^;]+)/i)

    if (!phpSessMatch) {
      throw new Error('SSS no devolvió PHPSESSID')
    }
    const phpSessId = phpSessMatch[1]

    // Extraer el sid del CAPTCHA desde el HTML
    // Buscar: securimage_show.php?sid=XXXXX o sid=XXXXX en la URL de la imagen
    const sidMatch =
      html.match(/securimage_show\.php\?sid=([a-f0-9]+)/i) ??
      html.match(/simage\/[^"']*\?[^"']*sid=([a-f0-9]+)/i)

    if (!sidMatch) {
      throw new Error('No se encontró el sid del CAPTCHA en el HTML de SSS')
    }
    const captchaSid = sidMatch[1]

    // ── 2. Descargar la imagen del CAPTCHA con la misma sesión ────────────────
    const imgUrl = `${SSS_BASE}/simage/securimage_show.php?sid=${captchaSid}`
    const imgRes = await fetch(imgUrl, {
      headers: {
        Cookie: `PHPSESSID=${phpSessId}`,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: SSS_PAGE,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (!imgRes.ok) {
      throw new Error(`Error al descargar imagen CAPTCHA: ${imgRes.status}`)
    }

    const imgBuffer = await imgRes.arrayBuffer()
    const imgBase64 = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') ?? 'image/png'

    return NextResponse.json({
      captchaImage: `data:${contentType};base64,${imgBase64}`,
      captchaSid,
      phpSessId,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[SSS Captcha]', msg)
    return NextResponse.json(
      { error: `No se pudo obtener el CAPTCHA de SSS: ${msg}` },
      { status: 502 },
    )
  }
}
