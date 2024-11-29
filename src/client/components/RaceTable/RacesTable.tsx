import { Box, Flex, Text } from '@mantine/core';

export function RacesTable({ data, loading }) {

    // Función para contar las razas

    const countRaces = (data) => {
        return data?.reduce((acc, player) => {
            if (player.race) {
                acc[player.race] = (acc[player.race] || 0) + 1;
            }
            return acc;
        }, {});
    };

    const raceCounts = countRaces(data || []);


    if (loading) {
        return <div>Loading...</div>;
    }

    // Mostrar el conteo de razas
    
    return (

    <Box>
        <Flex
          direction="row"
          gap="xl"
          wrap="wrap"
          align="center"
          justify="center"
        >
          {Object.entries(raceCounts).map(([race, count]) => (
            <Flex 
                key={race} 
                align="center"
                gap="0.5rem"
            >
              <img
                src={`../../client/assets/${race.toLocaleLowerCase()}.svg`}
                alt={`${race.toLocaleLowerCase()}`} 
                style={{ width: '36px', height: '36px' }}
              />
              <Text>
                {count}
              </Text>
            </Flex>
          ))}
        </Flex>
    </Box>

    );
}
