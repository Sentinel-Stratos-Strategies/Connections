import "react-native";

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }

  interface TextProps {
    className?: string;
  }

  interface TextInputProps {
    className?: string;
  }

  interface PressableProps {
    className?: string;
  }

  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }

  interface KeyboardAvoidingViewProps {
    className?: string;
  }

  interface FlatListProps<ItemT> {
    className?: string;
    contentContainerClassName?: string;
  }
}
