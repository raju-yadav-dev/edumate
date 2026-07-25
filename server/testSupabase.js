import supabase from "./config/supabase.js";

async function test() {

    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.log(error);
    } else {
        console.log(data);
    }

}

test();