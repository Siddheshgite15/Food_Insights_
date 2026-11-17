import sys
import os
import argparse
import time
import cv2

def parse_args():
    parser = argparse.ArgumentParser(description="External USB Webcam Test for Banana Food Insight")
    parser.add_argument(
        "--camera", "--index", "-c",
        type=int,
        default=0,
        help="Camera device index (default: 0 for USB2.0 PC CAMERA)."
    )
    return parser.parse_args()

def open_camera(camera_index: int = 0):
    """
    Opens the USB camera using DirectShow with auto-exposure sensor warm-up.
    """
    print(f"Connecting to USB camera (index={camera_index})...")
    if sys.platform.startswith("win"):
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(camera_index)
    else:
        cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        return cap, camera_index

    # Sensor warm-up
    print("Warming up camera sensor and auto-exposure...")
    for _ in range(12):
        cap.read()
        time.sleep(0.04)

    return cap, camera_index

def main():
    args = parse_args()
    camera_index = args.camera

    cap, camera_index = open_camera(camera_index)

    if not cap.isOpened():
        print("ERROR: Could not open USB camera.")
        print(f"Please check the USB connection or change CAMERA_INDEX (current: {camera_index}).")
        print("\nTip: Try running with a different index:")
        print(f"  python camera_test.py --camera {camera_index + 1}")
        sys.exit(1)

    print("Camera connected successfully.")
    print("Press Q to quit.\n")

    window_name = f"Banana Food Insight - USB Camera Test (Index {camera_index})"
    cv2.namedWindow(window_name, cv2.WINDOW_AUTOSIZE)

    prev_time = time.time()
    fps = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None or frame.mean() < 3.0:
                time.sleep(0.02)
                continue

            # Calculate FPS
            curr_time = time.time()
            fps = 0.9 * fps + 0.1 * (1.0 / max(curr_time - prev_time, 1e-5))
            prev_time = curr_time

            # Overlay info box
            h, w = frame.shape[:2]
            overlay = frame.copy()
            cv2.rectangle(overlay, (10, 10), (380, 85), (20, 20, 20), -1)
            cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

            cv2.putText(
                frame,
                f"USB Camera (Index {camera_index}) - Live Feed",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 200),
                1,
                cv2.LINE_AA
            )
            cv2.putText(
                frame,
                f"Resolution: {w}x{h} | FPS: {fps:.1f}",
                (20, 55),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (220, 220, 220),
                1,
                cv2.LINE_AA
            )
            cv2.putText(
                frame,
                "Press 'Q' to quit",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 200, 0),
                1,
                cv2.LINE_AA
            )

            cv2.imshow(window_name, frame)

            key = cv2.waitKey(1) & 0xFF
            if key in [ord('q'), ord('Q'), 27]:
                print("Quit signal received. Closing camera...")
                break

    except KeyboardInterrupt:
        print("\nInterrupted by user. Closing...")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Camera released. Window closed successfully.")

if __name__ == "__main__":
    main()
