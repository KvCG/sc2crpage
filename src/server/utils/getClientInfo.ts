export const getClientInfo = userAgent => {
    const regex =
        /(?:Android [\d\.]+|iPhone OS [\d_]+|Windows NT [\d\.]+|Mac OS X [\d_]+|CrOS [\d\.]+|Linux)|(?:iPhone|iPad|iPod|Android|Windows Phone|Macintosh|Windows|Linux|Mobile)|(?:Chrome\/[\d\.]+|Safari\/[\d\.]+|Firefox\/[\d\.]+|Opera\/[\d\.]+|Edg\/[\d\.]+|MSIE [\d\.]+|Trident\/[\d\.]+)/g

    const matches = [...userAgent.matchAll(regex)]

    let os =
        matches.find(match => match[0].includes('Android'))?.[0] ||
        matches.find(match => match[0].includes('iPhone OS'))?.[0] ||
        matches.find(match => match[0].includes('Windows NT'))?.[0] ||
        matches.find(match => match[0].includes('Mac OS X'))?.[0] ||
        matches.find(match => match[0].includes('Linux'))?.[0] ||
        'Unknown OS'

    const device =
        matches.find(
            match =>
                match[0].includes('iPhone') ||
                match[0].includes('iPad') ||
                match[0].includes('iPod') ||
                match[0].includes('Android') ||
                match[0].includes('Mobile')
        )?.[0] || 'Unknown Device'

    const browser =
        matches.find(
            match =>
                match[0].includes('Chrome') ||
                match[0].includes('Safari') ||
                match[0].includes('Firefox') ||
                match[0].includes('Opera') ||
                match[0].includes('Edg')
        )?.[0] || 'Unknown Browser'

    return { os, device, browser }
}
