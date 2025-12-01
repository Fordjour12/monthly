import { Card } from "heroui-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

type PlanSuggestionContent = {
  goals: Array<{
    title: string;
    description: string;
    category: string;
    tasks: Array<{
      title: string;
      priority: "low" | "medium" | "high";
      dueDate?: string;
    }>;
  }>;
};

const MOCK_PLAN: PlanSuggestionContent = {
  goals: [
    {
      title: "Week 1: Foundation",
      description: "Start with basic runs",
      category: "Health",
      tasks: [
        { title: "2km jog", priority: "medium", dueDate: "2023-10-01" },
        { title: "Stretching routine", priority: "low" },
      ]
    }
  ]
};

export default function PlanReviewScreen() {
  const router = useRouter();
  const { title, planContent } = useLocalSearchParams<{ title: string; planContent: string }>();

  let plan: PlanSuggestionContent | null = null;
  try {
    if (planContent) {
      plan = JSON.parse(planContent);
    }
  } catch (e) {
    console.error("Failed to parse plan content", e);
  }

  const displayPlan = plan || MOCK_PLAN;

  const handleAccept = () => {
    // TODO: Save plan to DB (actually it's already saved as a suggestion, we just need to 'apply' it)
    router.dismissAll();
    router.replace("/(drawer)/(tabs)");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Review AI Plan" }} />
      <ScrollView className="flex-1 bg-background p-4">
        <Text className="mb-4 text-xl font-bold text-foreground">
          Plan for: {title}
        </Text>

        {displayPlan.goals.map((goal, index) => (
          <View key={index} className="mb-4">
            <Text className="mb-2 text-lg font-semibold text-foreground">{goal.title}</Text>
            <Text className="mb-2 text-sm text-muted-foreground">{goal.description}</Text>
            
            {goal.tasks.map((task, tIndex) => (
              <Card key={tIndex} className="mb-2 p-3" variant="secondary">
                <View className="flex-row justify-between">
                  <Text className="text-foreground font-medium">{task.title}</Text>
                  <Text className="text-xs text-muted-foreground capitalize">{task.priority}</Text>
                </View>
                {task.dueDate && (
                  <Text className="text-xs text-muted-foreground mt-1">Due: {task.dueDate}</Text>
                )}
              </Card>
            ))}
          </View>
        ))}

        <View className="mt-6 flex-row gap-4 mb-8">
          <Pressable
            className="flex-1 items-center rounded-lg bg-surface border border-divider p-4 active:opacity-70"
            onPress={() => router.back()}
          >
            <Text className="font-medium text-foreground">Edit Goal</Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-lg bg-accent p-4 active:opacity-70"
            onPress={handleAccept}
          >
            <Text className="font-medium text-foreground">Accept Plan</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
