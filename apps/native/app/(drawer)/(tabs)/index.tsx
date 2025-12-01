import { Card } from "heroui-native";
import { View, Pressable, Text, ScrollView } from "react-native";
import { Container } from "@/components/container";
import { Link } from "expo-router";

const MOCK_GOALS = [
  { id: "1", title: "Run a Marathon", progress: 0.2, status: "active" },
  { id: "2", title: "Read 12 Books", progress: 0.5, status: "active" },
];

export default function Home() {
  return (
    <Container className="p-0">
      <ScrollView contentContainerClassName="p-6">
        <Text className="mb-6 text-3xl font-bold text-foreground">Monthly Planner</Text>

        <View className="mb-6">
          <Text className="mb-4 text-xl font-semibold text-foreground">Your Goals</Text>
          {MOCK_GOALS.map((goal) => (
            <Card key={goal.id} className="mb-3 p-4" variant="secondary">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-medium text-foreground">{goal.title}</Text>
                <Text className="text-sm text-muted-foreground">{goal.progress * 100}%</Text>
              </View>
            </Card>
          ))}
        </View>
          
        <Link href="/goals/new" asChild>
          <Pressable className="items-center rounded-lg bg-accent p-4 active:opacity-70">
            <Text className="font-medium text-foreground">Add New Goal</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </Container>
  );
}
