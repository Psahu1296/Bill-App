import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { BsCashCoin } from "react-icons/bs";
import { GrInProgress } from "react-icons/gr";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";
import { getDailyEarnings } from "../https";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

const Home: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Home"; }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["earnings"],
    queryFn: async () => getDailyEarnings(),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) enqueueSnackbar("Failed to load earnings data", { variant: "error" });
  }, [isError]);

  const earningsData = resData?.data?.data as
    | { todayEarning?: number; percentageChange?: number }
    | undefined;
  const earnings = Math.floor(Number(earningsData?.todayEarning ?? 0));
  const percent = earningsData?.percentageChange ?? 0;

  return (
    <section className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-24 overflow-y-auto">
      <div className="flex gap-6 px-6 pt-2">
        {/* Left column */}
        <div className="flex-[3] space-y-6">
          <Greetings />
          <div className="grid grid-cols-2 gap-4">
            <MiniCard
              title="Total Earnings"
              icon={<BsCashCoin />}
              number={earnings || 0}
              footerNum={percent || 0}
              variant="earnings"
            />
            <MiniCard
              title="In Progress"
              icon={<GrInProgress />}
              number={16}
              footerNum={3.6}
              variant="progress"
            />
          </div>
          <RecentOrders />
        </div>

        {/* Right column */}
        <div className="flex-[2]">
          <PopularDishes />
        </div>
      </div>
      <BottomNav />
    </section>
  );
};

export default Home;
