import { Stack, useRouter } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { orpc } from "@/utils/orpc";

export default function NewGoalScreen() {
  const router = useRouter();
  const [type, setType] = useState<"goal" | "habit" | "task">("goal");
  const [frequency, setFrequency] = useState("daily");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useAI, setUseAI] = useState(true);

  const mutedColor = useThemeColor("muted");
  const foregroundColor = useThemeColor("foreground");

  const generatePlan = orpc.ai.generatePlan.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/goals/plan-review",
        params: {
          title,
          planContent: JSON.stringify(data.content),
        },
      });
    },
    onError: (error) => {
      console.error("Failed to generate plan:", error);
      // TODO: Show error toast
    },
  });

  const handleCreate = () => {
    if (useAI) {
      generatePlan.mutate({
        userGoals: title + (description ? `\n${description}` : ""),
        workHours: "9am-5pm", // TODO: Get from user profile
        energyPatterns: "High in morning", // TODO: Get from user profile
        preferredTimes: "Morning", // TODO: Get from user profile
      });
    } else {
      // TODO: Implement actual mutation for manual creation
      console.log({
        type,
        frequency,
        title,
        description,
        category,
        startDate,
        endDate,
        useAI,
      });
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "New Goal" }} />
      <ScrollView className="flex-1 bg-background p-4">
        <Card className="p-4" variant="secondary">
          {/* ... existing fields ... */}
          <Text className="mb-2 font-medium text-foreground text-sm">Type</Text>
          <View className="mb-4 flex-row gap-2">
            {(["goal", "habit", "task"] as const).map((t) => (
              <Pressable
                className={`rounded-full border px-4 py-2 ${
                  type === t
                    ? "border-accent bg-accent"
                    : "border-divider bg-surface"
                }`}
                key={t}
                onPress={() => setType(t)}
              >
                <Text
                  className={`capitalize ${
                    type === t ? "text-white" : "text-foreground"
                  }`}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {type === "habit" && (
            <>
              <Text className="mb-2 font-medium text-foreground text-sm">
                Frequency
              </Text>
              <View className="mb-4 flex-row gap-2">
                {(["daily", "weekly", "monthly"] as const).map((f) => (
                  <Pressable
                    className={`rounded-full border px-4 py-2 ${
                      frequency === f
                        ? "border-accent bg-accent"
                        : "border-divider bg-surface"
                    }`}
                    key={f}
                    onPress={() => setFrequency(f)}
                  >
                    <Text
                      className={`capitalize ${
                        frequency === f ? "text-white" : "text-foreground"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text className="mb-2 font-medium text-foreground text-sm">
            Goal Title
          </Text>
          <TextInput
            className="mb-4 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
            onChangeText={setTitle}
            placeholder="e.g., Run a Marathon"
            placeholderTextColor={mutedColor}
            value={title}
          />

          <Text className="mb-2 font-medium text-foreground text-sm">
            Description
          </Text>
          <TextInput
            className="mb-4 min-h-[100px] rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
            multiline
            onChangeText={setDescription}
            placeholder="Describe your goal..."
            placeholderTextColor={mutedColor}
            textAlignVertical="top"
            value={description}
          />

          <Text className="mb-2 font-medium text-foreground text-sm">
            Category
          </Text>
          <TextInput
            className="mb-4 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
            onChangeText={setCategory}
            placeholder="e.g., Health, Career"
            placeholderTextColor={mutedColor}
            value={category}
          />

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="mb-2 font-medium text-foreground text-sm">
                Start Date
              </Text>
              <TextInput
                className="mb-4 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={mutedColor}
                value={startDate}
              />
            </View>
            <View className="flex-1">
              <Text className="mb-2 font-medium text-foreground text-sm">
                End Date
              </Text>
              <TextInput
                className="mb-4 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={mutedColor}
                value={endDate}
              />
            </View>
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-medium text-foreground text-sm">
              Generate Plan with AI
            </Text>
            <Switch onValueChange={setUseAI} value={useAI} />
          </View>

          <Pressable
            className="mt-4 flex-row items-center justify-center rounded-lg bg-accent p-4 active:opacity-70"
            disabled={generatePlan.isPending}
            onPress={handleCreate}
          >
            {generatePlan.isPending ? (
              <ActivityIndicator color={foregroundColor} />
            ) : (
              <Text className="font-medium text-foreground">
                {useAI ? "Create & Generate Plan" : "Create Goal"}
              </Text>
            )}
          </Pressable>
        </Card>
      </ScrollView>
    </>
  );
}
