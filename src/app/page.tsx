import ServerBrowser from './servers/page';

async function getServers() {
  const response = await fetch(`${process.env.API_URL}/servers`, {
    cache: 'no-store' // Disable caching to always get fresh data
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch servers');
  }
  
  return response.json();
}

export default async function Home() {
  const initialServers = await getServers();
  return <ServerBrowser initialServers={initialServers} />;
}
