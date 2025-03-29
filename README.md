# CS:S Server Browser

A modern, clean, and efficient server browser for Counter-Strike: Source. Built with Next.js and Tailwind CSS, this application provides a better way to find and connect to CS:S servers.

## Features

- 🎮 Real-time server list with player counts
- 🔍 Advanced filtering options:
  - Filter by server status (empty/full/non-empty-nor-full)
  - Filter by map name
  - Filter by server name
  - Filter by IP address
  - Hide servers with bots
  - Strip special characters from names
- 🎯 VIP server highlighting
- 🌙 Dark mode support
- 📱 Responsive design
- ⚡ Fast and efficient filtering with debouncing
- 🔄 Automatic server list updates
- 🎨 Modern, clean UI

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/nikooo777/play-css.com.git
cd play-css.com
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env.local` file in the root directory with the following content:
```env
NEXT_PUBLIC_API_URL=http://localhost:8888
NEXT_PUBLIC_VIP_IPS=54.37.245.51
```

4. Run the development server:
```bash
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

- `NEXT_PUBLIC_API_URL`: The URL of your CS:S server API
- `NEXT_PUBLIC_VIP_IPS`: Comma-separated list of VIP server IPs

## Built With

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime & package manager

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
