export const Logo = () => {
    return (
        <svg
            width="100"
            height="50"
            viewBox="0 0 400 150"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="none"
        >
            <g stroke="none" stroke-width="1">
                <circle
                    cx="75"
                    cy="75"
                    r="60"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="4"
                />
                <circle cx="75" cy="75" r="45" fill="#8A2BE2" />
                <circle cx="75" cy="75" r="30" fill="#FF4500" />
                <circle cx="75" cy="75" r="15" fill="#FFD700" />

                <circle
                    cx="75"
                    cy="75"
                    r="60"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="4"
                />
                <path
                    d="M75 15 L95 75 L135 75 L100 95 L115 140 L75 115 L35 140 L50 95 L15 75 L55 75 Z"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="3"
                />
                <circle
                    cx="75"
                    cy="75"
                    r="25"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="2"
                />
                <circle
                    cx="75"
                    cy="75"
                    r="10"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="2"
                />
                <path
                    d="M75 60 L85 75 L65 75 Z"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="2"
                />
                <path
                    d="M75 20 L85 35 L65 35 Z"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="1"
                />
                <path
                    d="M75 130 L85 115 L65 115 Z"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="1"
                />
            </g>

            <text
                x="150"
                y="85"
                font-family="'Arial Black', Gadget, sans-serif"
                font-size="36"
                fill="url(#text-gradient)"
                font-weight="bold"
            >
                SC2CR
            </text>

            <defs>
                <linearGradient
                    id="text-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                    <stop offset="0%" stop-color="#8A2BE2" />
                    <stop offset="50%" stop-color="#FF4500" />
                    <stop offset="100%" stop-color="#FFD700" />
                </linearGradient>
            </defs>
        </svg>
    )
}
